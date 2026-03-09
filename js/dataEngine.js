const dataEngine = {
    getColumnMapping: function() {
        return {
            date: ["date", "time", "timestamp", "التاريخ"],
            open: ["open", "opening", "open_price", "فتح"],
            high: ["high", "highest", "أعلى", "اعلى"],
            low: ["low", "lowest", "أدنى", "ادنى"],
            close: ["close", "closing", "close_price", "الإغلاق", "الاغلاق", "price"],
            volume: ["volume", "vol", "trade_volume", "الحجم", "حجم التداول"]
        };
    },

    findColumnIndex: function(headers, aliases) {
        // Exact match
        let idx = headers.findIndex(h => aliases.includes(h));
        if (idx !== -1) return idx;
        // Partial match
        return headers.findIndex(h => aliases.some(alias => h.includes(alias)));
    },

    pickColumnValue: function(obj, aliases) {
        const norm = (k) => String(k || "").toLowerCase().trim();
        const keys = Object.keys(obj || {});
        // Exact match
        for(const k of keys) {
            if(aliases.includes(norm(k))) return obj[k];
        }
        // Partial match
        for(const k of keys) {
            const nk = norm(k);
            if(aliases.some(alias => nk.includes(alias))) return obj[k];
        }
        return undefined;
    },

    getMissingColumnsError: function() {
        return "تعذر التعرف على أعمدة البيانات!\nيرجى التأكد من وجود الأعمدة التالية (أو ما يعادلها):\n" +
               "التاريخ (Date, Time, Timestamp)\n" +
               "الفتح (Open, Opening, فتح)\n" +
               "الأعلى (High, Highest, أعلى)\n" +
               "الأدنى (Low, Lowest, أدنى)\n" +
               "الإغلاق (Close, Closing, الإغلاق)\n" +
               "الحجم (Volume, Vol, الحجم)";
    },

    parseCSV: function(csvText) {
        const lines = String(csvText || "").trim().split(/\r?\n/);
        if(lines.length < 1) throw new Error("ملف فارغ أو غير صالح");
        const headers = splitCSVLine(lines[0]).map(h => h.trim().toLowerCase());
        
        const map = this.getColumnMapping();
        let dateIdx  = this.findColumnIndex(headers, map.date);
        let openIdx  = this.findColumnIndex(headers, map.open);
        let highIdx  = this.findColumnIndex(headers, map.high);
        let lowIdx   = this.findColumnIndex(headers, map.low);
        let closeIdx = this.findColumnIndex(headers, map.close);
        let volIdx   = this.findColumnIndex(headers, map.volume);

        let startIndex = 1;

        if(dateIdx < 0 || closeIdx < 0) {
            if (headers.length === 6) {
                dateIdx = 0;
                openIdx = 1;
                highIdx = 2;
                lowIdx = 3;
                closeIdx = 4;
                volIdx = 5;
                startIndex = 0;
            } else {
                throw new Error(this.getMissingColumnsError());
            }
        }

        const rows = [];
        for(let i = startIndex; i < lines.length; i++) {
            const cols = splitCSVLine(lines[i]);
            if(cols.length < 3) continue;

            const date = String(cols[dateIdx] || "").trim();
            const close = parseFloat(cols[closeIdx]);
            
            const فتح = openIdx >= 0 ? parseFloat(cols[openIdx]) : close;
            const high = highIdx >= 0 ? parseFloat(cols[highIdx]) : close;
            const low  = lowIdx >= 0 ? parseFloat(cols[lowIdx]) : close;
            const volume = volIdx >= 0 ? parseFloat(cols[volIdx]) : 0;

            if(date && !isNaN(close)) {
                rows.push({
                    date,
                    فتح: isNaN(فتح) ? close : فتح,
                    high: isNaN(high) ? close : high,
                    low: isNaN(low) ? close : low,
                    close,
                    volume: isNaN(volume) ? 0 : volume
                });
            }
        }

        rows.sort((a,b) => new Date(a.date) - new Date(b.date));
        if(rows.length < 2) throw new Error("لم يتم استخراج بيانات كافية من CSV");
        return rows;
    },

    parseJSON: function(jsonText) {
        let data;
        try { data = JSON.parse(jsonText); }
        catch(e) { throw new Error("JSON غير صالح"); }

        const arr = Array.isArray(data) ? data : (Array.isArray(data.rows) ? data.rows : null);
        if(!arr) throw new Error("JSON يجب أن يكون Array أو يحتوي rows[]");

        return this.normalizeRowObjects(arr);
    },

    parseExcelBuffer: function(arrayBuffer) {
        if(typeof XLSX === "undefined") {
            throw new Error("مكتبة Excel غير محمّلة");
        }
        const workbook = XLSX.read(arrayBuffer, { type: "array" });
        const firstSheet = workbook.SheetNames[0];
        if(!firstSheet) throw new Error("ملف Excel لا يحتوي على أوراق");
        const sheet = workbook.Sheets[firstSheet];
        const jsonRows = XLSX.utils.sheet_to_json(sheet, { defval: "" });
        if(!Array.isArray(jsonRows) || !jsonRows.length) {
            throw new Error("ملف Excel فارغ أو غير صالح");
        }
        return this.normalizeRowObjects(jsonRows);
    },

    normalizeRowObjects: function(arr) {
        const map = this.getColumnMapping();
        let validRowsFound = false;

        const rows = arr.map(o => {
            const date = this.pickColumnValue(o, map.date);
            const closeVal = this.pickColumnValue(o, map.close);
            
            if (date && closeVal !== undefined) {
                validRowsFound = true;
            }

            const close = parseFloat(closeVal);
            const openVal = this.pickColumnValue(o, map.open);
            const highVal = this.pickColumnValue(o, map.high);
            const lowVal = this.pickColumnValue(o, map.low);
            const volVal = this.pickColumnValue(o, map.volume);

            const فتح = parseFloat(openVal !== undefined ? openVal : close);
            const high = parseFloat(highVal !== undefined ? highVal : close);
            const low  = parseFloat(lowVal !== undefined ? lowVal : close);
            const volume = parseFloat(volVal !== undefined ? volVal : 0);

            return {
                date: String(date || ""),
                فتح: isNaN(فتح) ? close : فتح,
                high: isNaN(high) ? close : high,
                low: isNaN(low) ? close : low,
                close,
                volume: isNaN(volume) ? 0 : volume
            };
        }).filter(r => r.date && !isNaN(r.close));

        if(!validRowsFound) {
            throw new Error(this.getMissingColumnsError());
        }

        rows.sort((a,b) => new Date(a.date) - new Date(b.date));
        if(rows.length < 2) throw new Error("البيانات أقل من الحد الأدنى المطلوب للتحليل أو " + this.getMissingColumnsError());
        return rows;
    },

    loadFromFile: function(file) {
        return new Promise((resolve, reject) => {
            const ext = (file.name.split('.').pop() || "").toLowerCase();
            const reader = new FileReader();

            reader.onload = e => {
                try {
                    let rows;
                    if(ext === "json") {
                        rows = this.parseJSON(e.target.result);
                    } else if(ext === "csv" || ext === "txt") {
                        rows = this.parseCSV(e.target.result);
                    } else if(ext === "xlsx" || ext === "xls") {
                        rows = this.parseExcelBuffer(e.target.result);
                    } else {
                        throw new Error("نوع الملف غير مدعوم. استخدم CSV أو JSON أو XLS/XLSX");
                    }
                    resolve(rows);
                } catch(err) {
                    reject(err);
                }
            };

            reader.onerror = () => reject(new Error("تعذر قراءة الملف"));

            if(ext === "xlsx" || ext === "xls") {
                reader.readAsArrayBuffer(file);
            } else {
                reader.readAsText(file);
            }
        });
    }
};

// Multi-stock screener: parse any CSV/JSON/XLS/XLSX into raw row objects
dataEngine.parseFileToRows = function(file) {
    return new Promise((resolve, reject) => {
        const ext = (file.name.split('.').pop() || "").toLowerCase();
        const reader = new FileReader();

        reader.onload = e => {
            try {
                let rows;
                if(ext === "json") {
                    const data = JSON.parse(e.target.result);
                    rows = Array.isArray(data) ? data : (Array.isArray(data.rows) ? data.rows : []);
                } else if(ext === "csv" || ext === "txt") {
                    rows = parseGenericCSV(e.target.result);
                } else if(ext === "xlsx" || ext === "xls") {
                    if(typeof XLSX === "undefined") throw new Error("مكتبة Excel غير محمّلة");
                    const workbook = XLSX.read(e.target.result, { type: "array" });
                    const firstSheet = workbook.SheetNames[0];
                    if(!firstSheet) throw new Error("ملف Excel لا يحتوي على أوراق");
                    rows = XLSX.utils.sheet_to_json(workbook.Sheets[firstSheet], { defval: "" });
                } else {
                    throw new Error("نوع الملف غير مدعوم");
                }

                if(!Array.isArray(rows) || rows.length === 0) {
                    throw new Error("لم يتم استخراج أي صفوف من الملف");
                }
                resolve(rows);
            } catch(err) {
                reject(err);
            }
        };

        reader.onerror = () => reject(new Error("تعذر قراءة الملف"));

        if(ext === "xlsx" || ext === "xls") {
            reader.readAsArrayBuffer(file);
        } else {
            reader.readAsText(file);
        }
    });
};

function parseGenericCSV(csvText) {
    const lines = String(csvText || "").split(/\r?\n/).filter(l => l.trim().length);
    if(lines.length < 2) return [];
    const headers = splitCSVLine(lines[0]).map(h => h.trim());
    const out = [];
    for(let i = 1; i < lines.length; i++){
        const cols = splitCSVLine(lines[i]);
        if(!cols.length) continue;
        const row = {};
        for(let c = 0; c < headers.length; c++){
            row[headers[c]] = (cols[c] ?? "").trim();
        }
        out.push(row);
    }
    return out;
}

function splitCSVLine(line) {
    const res = [];
    let cur = "", inQ = false;
    for(let i = 0; i < line.length; i++){
        const ch = line[i];
        if(ch === '"'){
            if(inQ && line[i+1] === '"'){ cur += '"'; i++; }
            else inQ = !inQ;
        } else if(ch === ',' && !inQ){
            res.push(cur); cur = "";
        } else {
            cur += ch;
        }
    }
    res.push(cur);
    return res;
}
