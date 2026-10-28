/**
 * OneScript ONLYOFFICE Bridge Plugin
 * Connects ONLYOFFICE Document Builder API with React Application and FastAPI AI Engine
 */
(function(window, undefined) {
    const PLUGIN_GUID = "asc.{9FDA57E0-71DF-4658-92DB-30387D3DAC70}";

    function announceReady(targetWindow) {
        var targets = [targetWindow, window.top, window.parent];
        targets.forEach(function(win) {
            if (win) {
                try {
                    win.postMessage({
                        type: "ONESCRIPT_PLUGIN_READY",
                        guid: PLUGIN_GUID
                    }, "*");
                } catch (e) {}
            }
        });
    }

    // Proactive ready announcement
    announceReady();
    setTimeout(announceReady, 300);
    setTimeout(announceReady, 1000);

    window.Asc.plugin.init = function() {
        console.log("[OneScript Bridge] Plugin initialized and ready.");
        announceReady();
    };

    window.Asc.plugin.button = function(id) {
        // Fallback button handler
    };

    // Listen for selection changes inside the document
    window.Asc.plugin.event_onTargetPositionChanged = function() {
        this.callCommand(function() {
            var oDocument = Api.GetDocument();
            var oRange = oDocument.GetRangeBySelect();
            if (!oRange) {
                return { text: "", isEmpty: true, paraIndex: null };
            }

            var selText = oRange.GetText();
            var oPara = oRange.GetParagraph(0);
            var paraIndex = null;
            var paraText = "";

            if (oPara) {
                paraText = oPara.GetText();
                var allParas = oDocument.GetAllParagraphs ? oDocument.GetAllParagraphs() : [];
                for (var i = 0; i < allParas.length; i++) {
                    if (allParas[i].GetText() === paraText) {
                        paraIndex = i;
                        break;
                    }
                }
            }

            return {
                text: selText,
                paraText: paraText,
                paraIndex: paraIndex,
                isEmpty: oRange.IsEmpty()
            };
        }, false, true, function(selectionData) {
            if (window.top && selectionData) {
                window.top.postMessage({
                    type: "ONESCRIPT_SELECTION_CHANGED",
                    data: selectionData
                }, "*");
            }
        });
    };

    // Color parser supporting Hex, Named colors, and RGB
    function parseColor(colStr) {
        if (!colStr) return [15, 23, 42];
        var col = String(colStr).trim().toLowerCase();
        if (col.startsWith("#")) {
            if (col.length === 7) {
                return [
                    parseInt(col.slice(1, 3), 16),
                    parseInt(col.slice(3, 5), 16),
                    parseInt(col.slice(5, 7), 16)
                ];
            } else if (col.length === 4) {
                return [
                    parseInt(col[1] + col[1], 16),
                    parseInt(col[2] + col[2], 16),
                    parseInt(col[3] + col[3], 16)
                ];
            }
        }
        var named = {
            blue: [37, 99, 235],
            red: [220, 38, 38],
            green: [5, 150, 105],
            yellow: [234, 179, 8],
            orange: [249, 115, 22],
            purple: [139, 92, 246],
            pink: [236, 72, 153],
            cyan: [6, 182, 212],
            teal: [13, 148, 136],
            slate: [71, 85, 105],
            black: [15, 23, 42],
            white: [255, 255, 255],
            gray: [100, 116, 139],
            grey: [100, 116, 139],
            gold: [217, 119, 6]
        };
        return named[col] || [15, 23, 42];
    }

    // Extensible Declarative Formatter Registry
    var FORMATTERS = {
        // Character & Typography Properties
        bold: function(ctx, val) {
            if (ctx.range && ctx.range.SetBold) ctx.range.SetBold(Boolean(val));
            if (ctx.paragraph && ctx.paragraph.SetBold) ctx.paragraph.SetBold(Boolean(val));
        },
        italic: function(ctx, val) {
            if (ctx.range && ctx.range.SetItalic) ctx.range.SetItalic(Boolean(val));
            if (ctx.paragraph && ctx.paragraph.SetItalic) ctx.paragraph.SetItalic(Boolean(val));
        },
        underline: function(ctx, val) {
            if (ctx.range && ctx.range.SetUnderline) ctx.range.SetUnderline(Boolean(val));
            if (ctx.paragraph && ctx.paragraph.SetUnderline) ctx.paragraph.SetUnderline(Boolean(val));
        },
        strikethrough: function(ctx, val) {
            if (ctx.range && ctx.range.SetStrikeout) ctx.range.SetStrikeout(Boolean(val));
            if (ctx.paragraph && ctx.paragraph.SetStrikeout) ctx.paragraph.SetStrikeout(Boolean(val));
        },
        strike: function(ctx, val) {
            FORMATTERS.strikethrough(ctx, val);
        },
        font_size: function(ctx, val) {
            var sz = parseInt(val, 10);
            if (!isNaN(sz)) {
                // In ONLYOFFICE Document Builder API, 1 pt = 2 half-points (hps)
                if (sz < 50) sz = sz * 2;
                if (ctx.range && ctx.range.SetFontSize) ctx.range.SetFontSize(sz);
                if (ctx.paragraph && ctx.paragraph.SetFontSize) ctx.paragraph.SetFontSize(sz);
            }
        },
        fontsize: function(ctx, val) { FORMATTERS.font_size(ctx, val); },
        size: function(ctx, val) { FORMATTERS.font_size(ctx, val); },
        font_family: function(ctx, val) {
            if (val) {
                if (ctx.range && ctx.range.SetFontFamily) ctx.range.SetFontFamily(String(val));
                if (ctx.paragraph && ctx.paragraph.SetFontFamily) ctx.paragraph.SetFontFamily(String(val));
            }
        },
        fontfamily: function(ctx, val) { FORMATTERS.font_family(ctx, val); },
        font: function(ctx, val) { FORMATTERS.font_family(ctx, val); },
        color: function(ctx, val) {
            var rgb = parseColor(val);
            if (ctx.range && ctx.range.SetColor) ctx.range.SetColor(rgb[0], rgb[1], rgb[2]);
            if (ctx.paragraph && ctx.paragraph.SetColor) ctx.paragraph.SetColor(rgb[0], rgb[1], rgb[2]);
        },
        text_color: function(ctx, val) { FORMATTERS.color(ctx, val); },
        font_color: function(ctx, val) { FORMATTERS.color(ctx, val); },
        highlight: function(ctx, val) {
            var h = val ? (typeof val === "string" ? val.toLowerCase() : "yellow") : "none";
            ctx.range.SetHighlight(h);
        },
        subscript: function(ctx, val) {
            ctx.range.SetVertAlign(val ? "subscript" : "baseline");
        },
        superscript: function(ctx, val) {
            ctx.range.SetVertAlign(val ? "superscript" : "baseline");
        },
        text_case: function(ctx, val) {
            var curText = ctx.range.GetText();
            var tc = String(val).toLowerCase();
            var transformed = curText;
            if (tc === "uppercase") transformed = curText.toUpperCase();
            else if (tc === "lowercase") transformed = curText.toLowerCase();
            else if (tc === "capitalize") {
                transformed = curText.replace(/\b\w/g, function(l) { return l.toUpperCase(); });
            }
            ctx.range.Delete();
            ctx.range.AddText(transformed);
        },
        case: function(ctx, val) { FORMATTERS.text_case(ctx, val); },

        // Paragraph & Layout Properties
        alignment: function(ctx, val) {
            var oPara = ctx.paragraph || (ctx.range.GetParagraph ? ctx.range.GetParagraph(0) : null);
            if (oPara && oPara.SetJc) {
                var alignStr = String(val).toLowerCase();
                var jc = "left";
                if (alignStr === "center") jc = "center";
                else if (alignStr === "right") jc = "right";
                else if (alignStr === "justify" || alignStr === "both") jc = "both";
                oPara.SetJc(jc);
            }
        },
        align: function(ctx, val) { FORMATTERS.alignment(ctx, val); },
        line_spacing: function(ctx, val) {
            var oPara = ctx.paragraph || (ctx.range.GetParagraph ? ctx.range.GetParagraph(0) : null);
            if (oPara && oPara.SetSpacingLine) {
                var mult = parseFloat(val);
                if (!isNaN(mult)) {
                    oPara.SetSpacingLine(mult * 240, "multiple");
                }
            }
        },
        linespacing: function(ctx, val) { FORMATTERS.line_spacing(ctx, val); },
        indent: function(ctx, val) {
            var oPara = ctx.paragraph || (ctx.range.GetParagraph ? ctx.range.GetParagraph(0) : null);
            if (oPara && oPara.SetIndLeft) {
                var ind = parseFloat(val);
                if (!isNaN(ind)) oPara.SetIndLeft(ind * 20); // 1pt = 20 twips
            }
        },
        indent_left: function(ctx, val) { FORMATTERS.indent(ctx, val); },
        indent_first_line: function(ctx, val) {
            var oPara = ctx.paragraph || (ctx.range.GetParagraph ? ctx.range.GetParagraph(0) : null);
            if (oPara && oPara.SetIndFirstLine) {
                var ind = parseFloat(val);
                if (!isNaN(ind)) oPara.SetIndFirstLine(ind * 20);
            }
        },
        spacing_before: function(ctx, val) {
            var oPara = ctx.paragraph || (ctx.range.GetParagraph ? ctx.range.GetParagraph(0) : null);
            if (oPara && oPara.SetSpacingBefore) {
                var sp = parseFloat(val);
                if (!isNaN(sp)) oPara.SetSpacingBefore(sp * 20);
            }
        },
        spacing_after: function(ctx, val) {
            var oPara = ctx.paragraph || (ctx.range.GetParagraph ? ctx.range.GetParagraph(0) : null);
            if (oPara && oPara.SetSpacingAfter) {
                var sp = parseFloat(val);
                if (!isNaN(sp)) oPara.SetSpacingAfter(sp * 20);
            }
        }
    };

    // Core Document Action Execution Engine
    function executeAction(payload) {
        if (!payload) return;
        Asc.scope.payload = payload;

        window.Asc.plugin.callCommand(function() {
            var oDocument = Api.GetDocument();
            var p = Asc.scope.payload;
            var action = p.action || "SET_STYLE";

            // Inlined Color Parser
            function parseColor(colStr) {
                if (!colStr) return [15, 23, 42];
                var col = String(colStr).trim().toLowerCase();
                if (col.startsWith("#")) {
                    if (col.length === 7) {
                        return [
                            parseInt(col.slice(1, 3), 16),
                            parseInt(col.slice(3, 5), 16),
                            parseInt(col.slice(5, 7), 16)
                        ];
                    } else if (col.length === 4) {
                        return [
                            parseInt(col[1] + col[1], 16),
                            parseInt(col[2] + col[2], 16),
                            parseInt(col[3] + col[3], 16)
                        ];
                    }
                }
                var named = {
                    blue: [37, 99, 235],
                    red: [220, 38, 38],
                    green: [5, 150, 105],
                    yellow: [234, 179, 8],
                    orange: [249, 115, 22],
                    purple: [139, 92, 246],
                    pink: [236, 72, 153],
                    cyan: [6, 182, 212],
                    teal: [13, 148, 136],
                    slate: [71, 85, 105],
                    black: [15, 23, 42],
                    white: [255, 255, 255],
                    gray: [100, 116, 139],
                    grey: [100, 116, 139],
                    gold: [217, 119, 6]
                };
                return named[col] || [15, 23, 42];
            }

            // Safe Range Extractor for ONLYOFFICE ApiParagraph
            function getSafeRange(para) {
                if (!para) return null;
                try {
                    var txt = para.GetText ? (para.GetText() || "") : "";
                    var len = txt.length;
                    if (len > 0 && para.GetRange) {
                        return para.GetRange(0, len - 1);
                    }
                } catch(e) {}
                return null;
            }

            // Inlined Formatter Registry
            var FORMATTERS = {
                bold: function(ctx, val) {
                    var bVal = (val === true || String(val).toLowerCase() === "true" || val === 1 || String(val) === "1");
                    if (ctx.paragraph && ctx.paragraph.SetBold) {
                        try { ctx.paragraph.SetBold(bVal); } catch(e) {}
                    }
                    if (ctx.range && ctx.range.SetBold) {
                        try { ctx.range.SetBold(bVal); } catch(e) {}
                    }
                },
                italic: function(ctx, val) {
                    var iVal = (val === true || String(val).toLowerCase() === "true" || val === 1 || String(val) === "1");
                    if (ctx.paragraph && ctx.paragraph.SetItalic) {
                        try { ctx.paragraph.SetItalic(iVal); } catch(e) {}
                    }
                    if (ctx.range && ctx.range.SetItalic) {
                        try { ctx.range.SetItalic(iVal); } catch(e) {}
                    }
                },
                underline: function(ctx, val) {
                    var uVal = (val === true || String(val).toLowerCase() === "true" || val === 1 || String(val) === "1");
                    if (ctx.paragraph && ctx.paragraph.SetUnderline) {
                        try { ctx.paragraph.SetUnderline(uVal); } catch(e) {}
                    }
                    if (ctx.range && ctx.range.SetUnderline) {
                        try { ctx.range.SetUnderline(uVal); } catch(e) {}
                    }
                },
                strikethrough: function(ctx, val) {
                    var sVal = (val === true || String(val).toLowerCase() === "true" || val === 1 || String(val) === "1");
                    if (ctx.paragraph && ctx.paragraph.SetStrikeout) {
                        try { ctx.paragraph.SetStrikeout(sVal); } catch(e) {}
                    }
                    if (ctx.range && ctx.range.SetStrikeout) {
                        try { ctx.range.SetStrikeout(sVal); } catch(e) {}
                    }
                },
                strike: function(ctx, val) { FORMATTERS.strikethrough(ctx, val); },
                font_size: function(ctx, val) {
                    var sz = parseInt(val, 10);
                    if (!isNaN(sz)) {
                        if (sz < 50) sz = sz * 2; // 1pt = 2 half-points
                        if (ctx.paragraph && ctx.paragraph.SetFontSize) {
                            try { ctx.paragraph.SetFontSize(sz); } catch(e) {}
                        }
                        if (ctx.range && ctx.range.SetFontSize) {
                            try { ctx.range.SetFontSize(sz); } catch(e) {}
                        }
                    }
                },
                fontsize: function(ctx, val) { FORMATTERS.font_size(ctx, val); },
                size: function(ctx, val) { FORMATTERS.font_size(ctx, val); },
                font_family: function(ctx, val) {
                    if (val) {
                        if (ctx.paragraph && ctx.paragraph.SetFontFamily) {
                            try { ctx.paragraph.SetFontFamily(String(val)); } catch(e) {}
                        }
                        if (ctx.range && ctx.range.SetFontFamily) {
                            try { ctx.range.SetFontFamily(String(val)); } catch(e) {}
                        }
                    }
                },
                fontfamily: function(ctx, val) { FORMATTERS.font_family(ctx, val); },
                font: function(ctx, val) { FORMATTERS.font_family(ctx, val); },
                color: function(ctx, val) {
                    var rgb = parseColor(val);
                    var oColor = null;
                    try {
                        if (typeof Api !== "undefined" && Api.CreateColorFromRGB) {
                            oColor = Api.CreateColorFromRGB(rgb[0], rgb[1], rgb[2]);
                        }
                    } catch(e) {}
                    if (ctx.paragraph && ctx.paragraph.SetColor) {
                        try {
                            if (oColor) ctx.paragraph.SetColor(oColor);
                            else ctx.paragraph.SetColor(rgb[0], rgb[1], rgb[2]);
                        } catch(e) {}
                    }
                    if (ctx.range && ctx.range.SetColor) {
                        try {
                            if (oColor) ctx.range.SetColor(oColor);
                            else ctx.range.SetColor(rgb[0], rgb[1], rgb[2]);
                        } catch(e) {}
                    }
                },
                text_color: function(ctx, val) { FORMATTERS.color(ctx, val); },
                font_color: function(ctx, val) { FORMATTERS.color(ctx, val); },
                highlight: function(ctx, val) {
                    var h = val ? (typeof val === "string" ? val.toLowerCase() : "yellow") : "none";
                    if (ctx.paragraph && ctx.paragraph.SetHighlight) {
                        try { ctx.paragraph.SetHighlight(h); } catch(e) {}
                    }
                    if (ctx.range && ctx.range.SetHighlight) {
                        try { ctx.range.SetHighlight(h); } catch(e) {}
                    }
                },
                subscript: function(ctx, val) {
                    if (ctx.range && ctx.range.SetVertAlign) {
                        try { ctx.range.SetVertAlign(val ? "subscript" : "baseline"); } catch(e) {}
                    }
                },
                superscript: function(ctx, val) {
                    if (ctx.range && ctx.range.SetVertAlign) {
                        try { ctx.range.SetVertAlign(val ? "superscript" : "baseline"); } catch(e) {}
                    }
                },
                text_case: function(ctx, val) {
                    var targetRange = ctx.range || getSafeRange(ctx.paragraph);
                    if (!targetRange) return;
                    try {
                        var curText = targetRange.GetText();
                        var tc = String(val).toLowerCase();
                        var transformed = curText;
                        if (tc === "uppercase") transformed = curText.toUpperCase();
                        else if (tc === "lowercase") transformed = curText.toLowerCase();
                        else if (tc === "capitalize") {
                            transformed = curText.replace(/\b\w/g, function(l) { return l.toUpperCase(); });
                        }
                        targetRange.Delete();
                        targetRange.AddText(transformed);
                    } catch(e) {}
                },
                case: function(ctx, val) { FORMATTERS.text_case(ctx, val); },
                alignment: function(ctx, val) {
                    var oPara = ctx.paragraph || (ctx.range && ctx.range.GetParagraph ? ctx.range.GetParagraph(0) : null);
                    if (oPara && oPara.SetJc) {
                        var alignStr = String(val).toLowerCase();
                        var jc = "left";
                        if (alignStr === "center") jc = "center";
                        else if (alignStr === "right") jc = "right";
                        else if (alignStr === "justify" || alignStr === "both") jc = "both";
                        try { oPara.SetJc(jc); } catch(e) {}
                    }
                },
                align: function(ctx, val) { FORMATTERS.alignment(ctx, val); },
                line_spacing: function(ctx, val) {
                    var oPara = ctx.paragraph || (ctx.range && ctx.range.GetParagraph ? ctx.range.GetParagraph(0) : null);
                    if (oPara && oPara.SetSpacingLine) {
                        var mult = parseFloat(val);
                        if (!isNaN(mult)) {
                            try { oPara.SetSpacingLine(mult * 240, "multiple"); } catch(e) {}
                        }
                    }
                },
                linespacing: function(ctx, val) { FORMATTERS.line_spacing(ctx, val); },
                indent: function(ctx, val) {
                    var oPara = ctx.paragraph || (ctx.range && ctx.range.GetParagraph ? ctx.range.GetParagraph(0) : null);
                    if (oPara && oPara.SetIndLeft) {
                        var ind = parseFloat(val);
                        if (!isNaN(ind)) {
                            try { oPara.SetIndLeft(ind * 20); } catch(e) {}
                        }
                    }
                },
                indent_first_line: function(ctx, val) {
                    var oPara = ctx.paragraph || (ctx.range && ctx.range.GetParagraph ? ctx.range.GetParagraph(0) : null);
                    if (oPara && oPara.SetIndFirstLine) {
                        var ind = parseFloat(val);
                        if (!isNaN(ind)) {
                            try { oPara.SetIndFirstLine(ind * 20); } catch(e) {}
                        }
                    }
                },
                spacing_before: function(ctx, val) {
                    var oPara = ctx.paragraph || (ctx.range && ctx.range.GetParagraph ? ctx.range.GetParagraph(0) : null);
                    if (oPara && oPara.SetSpacingBefore) {
                        var sp = parseFloat(val);
                        if (!isNaN(sp)) {
                            try { oPara.SetSpacingBefore(sp * 20); } catch(e) {}
                        }
                    }
                },
                spacing_after: function(ctx, val) {
                    var oPara = ctx.paragraph || (ctx.range && ctx.range.GetParagraph ? ctx.range.GetParagraph(0) : null);
                    if (oPara && oPara.SetSpacingAfter) {
                        var sp = parseFloat(val);
                        if (!isNaN(sp)) {
                            try { oPara.SetSpacingAfter(sp * 20); } catch(e) {}
                        }
                    }
                }
            };

            // Inlined Target Range Locator (Semantic-First, Zero-Index Fragility)
            function locateTarget(doc, param) {
                var allParas = doc.GetAllParagraphs ? doc.GetAllParagraphs() : [];
                if (!allParas || allParas.length === 0) return null;

                // 1. PRIMARY STRATEGY: Semantic Text & Keyword Grounding across all paragraphs
                var rawSearch = param.targetText || param.targetQuery || "";
                if (typeof rawSearch === "string" && rawSearch.trim().length > 0) {
                    var cleanPhrase = rawSearch.replace(/[\t\r\n]+/g, " ").trim();
                    var lowerPhrase = cleanPhrase.toLowerCase();
                    var words = lowerPhrase.split(/[^a-z0-9]+/).filter(function(w) { return w.length >= 2; });

                    // A. Direct full-phrase search in document via doc.Search
                    try {
                        var docMatches = doc.Search(cleanPhrase, false);
                        if (docMatches && docMatches.length > 0) {
                            var mRange = docMatches[0];
                            var mPara = mRange.GetParagraph ? mRange.GetParagraph(0) : null;
                            return { range: mRange, paragraph: mPara, index: null };
                        }
                    } catch(e) {}

                    // B. Exact substring search inside each paragraph (handles tab separation like "NAME\t: SARAVANA")
                    for (var i = 0; i < allParas.length; i++) {
                        var curP = allParas[i];
                        var pText = curP.GetText();
                        if (!pText) continue;
                        var pNorm = pText.replace(/[\t\r\n]+/g, " ").trim().toLowerCase();

                        if (pNorm.indexOf(lowerPhrase) !== -1 || (lowerPhrase.length >= 6 && pNorm.indexOf(lowerPhrase.substring(0, Math.min(30, lowerPhrase.length))) !== -1)) {
                            try {
                                var inParaMatch = curP.Search(cleanPhrase, false);
                                if (inParaMatch && inParaMatch.length > 0) {
                                    return { range: inParaMatch[0], paragraph: curP, index: i };
                                }
                            } catch(e) {}
                            return { range: getSafeRange(curP), paragraph: curP, index: i };
                        }
                    }

                    // C. Token Overlap Scorer (best paragraph matching key words like "NAME", "REG NO", "SARAVANA")
                    var bestPara = null;
                    var bestScore = 0;
                    var bestIndex = -1;
                    var bestWordRange = null;

                    for (var i = 0; i < allParas.length; i++) {
                        var curP = allParas[i];
                        var pText = curP.GetText();
                        if (!pText) continue;
                        var pNorm = pText.replace(/[\t\r\n]+/g, " ").trim().toLowerCase();

                        var score = 0;
                        for (var w = 0; w < words.length; w++) {
                            var word = words[w];
                            if (pNorm.indexOf(word) !== -1) {
                                score += (word.length >= 4 ? 3 : 1);
                            }
                        }

                        if (score > bestScore) {
                            bestScore = score;
                            bestPara = curP;
                            bestIndex = i;
                            bestWordRange = null;
                            for (var w = 0; w < words.length; w++) {
                                var word = words[w];
                                if (word.length >= 4) {
                                    try {
                                        var wrMatch = curP.Search(word, false);
                                        if (wrMatch && wrMatch.length > 0) {
                                            bestWordRange = wrMatch[0];
                                            break;
                                        }
                                    } catch(e) {}
                                }
                            }
                        }
                    }

                    if (bestPara && bestScore >= 2) {
                        return {
                            range: (param.action === "REPLACE_TEXT" || (param.property === "color" && param.targetText && param.targetText.length < 25)) && bestWordRange ? bestWordRange : getSafeRange(bestPara),
                            paragraph: bestPara,
                            index: bestIndex
                        };
                    }
                }

                // 2. Active WYSIWYG Selection if user highlighted text
                try {
                    var selRange = doc.GetRangeBySelect();
                    if (selRange && !selRange.IsEmpty()) {
                        var oPara = selRange.GetParagraph ? selRange.GetParagraph(0) : null;
                        return { range: selRange, paragraph: oPara, index: null };
                    }
                } catch(e) {}

                // 3. Title Fallback
                if (param.targetId && (param.targetId.indexOf("title") !== -1 || param.targetId === "paragraph_0_0" || param.targetId === "heading_0_0")) {
                    for (var i = 0; i < allParas.length; i++) {
                        if (allParas[i].GetText() && allParas[i].GetText().trim().length > 0) {
                            return { range: getSafeRange(allParas[i]), paragraph: allParas[i], index: i };
                        }
                    }
                }

                // 4. LAST-RESORT FALLBACK: Explicit Numeric Paragraph Index (only if text search yielded nothing)
                if (typeof param.paraIndex === "number" && param.paraIndex >= 0 && param.paraIndex < allParas.length) {
                    var para = allParas[param.paraIndex];
                    return { range: getSafeRange(para), paragraph: para, index: param.paraIndex };
                }

                if (allParas.length > 0) {
                    for (var i = 0; i < allParas.length; i++) {
                        if (allParas[i].GetText() && allParas[i].GetText().trim().length > 0) {
                            return { range: getSafeRange(allParas[i]), paragraph: allParas[i], index: i };
                        }
                    }
                    return { range: getSafeRange(allParas[0]), paragraph: allParas[0], index: 0 };
                }

                return null;
            }

            try {
                // 1. SET_STYLE
                if (action === "SET_STYLE") {
                    var target = locateTarget(oDocument, p);
                    if (target && (target.range || target.paragraph)) {
                        try {
                            if (target.range && target.range.Select) target.range.Select();
                            else if (target.paragraph && target.paragraph.Select) target.paragraph.Select();
                        } catch(e) {}
                        var ctx = {
                            range: target.range || getSafeRange(target.paragraph),
                            paragraph: target.paragraph,
                            document: oDocument
                        };

                        if (p.updates && typeof p.updates === "object") {
                            for (var k in p.updates) {
                                var fn = FORMATTERS[String(k).toLowerCase()];
                                if (fn) fn(ctx, p.updates[k]);
                            }
                        }

                        if (p.property !== undefined && p.value !== undefined) {
                            var singleFn = FORMATTERS[String(p.property).toLowerCase()];
                            if (singleFn) singleFn(ctx, p.value);
                        }

                        return { success: true, action: action, targetIndex: target.index };
                    }
                    return { success: false, error: "Target not located" };
                }
                // 2. REPLACE_TEXT / EDIT_CONTENT
                else if (action === "REPLACE_TEXT" || action === "EDIT_CONTENT") {
                    var target = locateTarget(oDocument, p);
                    var newText = p.newText || p.value || "";
                    if (target && (target.range || target.paragraph)) {
                        // Sub-string replacement inside paragraph if targetText was found
                        if (target.paragraph && p.targetText) {
                            var curText = target.paragraph.GetText();
                            if (curText) {
                                var idx = curText.toLowerCase().indexOf(p.targetText.toLowerCase());
                                if (idx !== -1) {
                                    var before = curText.substring(0, idx);
                                    var after = curText.substring(idx + p.targetText.length);
                                    var replaced = before + newText + after;
                                    target.paragraph.RemoveAllElements();
                                    target.paragraph.AddText(replaced);
                                    return { success: true, action: action, targetIndex: target.index, replaced: true };
                                }
                            }
                        }
                        var tRange = target.range || getSafeRange(target.paragraph);
                        if (tRange) {
                            tRange.Delete();
                            tRange.AddText(newText);
                            return { success: true, action: action, targetIndex: target.index };
                        }
                    }
                    return { success: false, error: "Target not located" };
                }
                // 3. INSERT_PARAGRAPH / ADD_CONTENT
                else if (action === "INSERT_PARAGRAPH" || action === "ADD_CONTENT") {
                    var oParagraph = Api.CreateParagraph();
                    var textToInsert = p.text || p.newText || p.value || "";
                    oParagraph.AddText(textToInsert);
                    if (p.bold) oParagraph.SetBold(true);
                    if (p.fontSize) {
                        var sz = parseInt(p.fontSize, 10);
                        if (sz < 50) sz = sz * 2;
                        oParagraph.SetFontSize(sz);
                    }
                    oDocument.InsertContent([oParagraph]);
                    return { success: true, action: action };
                }
                // 4. DELETE_ELEMENT / DELETE_SELECTION / REMOVE_CONTENT
                else if (action === "DELETE_ELEMENT" || action === "DELETE_SELECTION" || action === "REMOVE_CONTENT") {
                    var target = locateTarget(oDocument, p);
                    if (target && (target.range || target.paragraph)) {
                        var delRange = target.range || getSafeRange(target.paragraph);
                        if (delRange) delRange.Delete();
                        return { success: true, action: action, targetIndex: target.index };
                    }
                    return { success: false, error: "Target not located" };
                }
                // 5. CLEAR_STYLE
                else if (action === "CLEAR_STYLE") {
                    var target = locateTarget(oDocument, p);
                    if (target && (target.range || target.paragraph)) {
                        var clrRange = target.range || getSafeRange(target.paragraph);
                        if (clrRange) {
                            try { clrRange.SetBold(false); } catch(e) {}
                            try { clrRange.SetItalic(false); } catch(e) {}
                            try { clrRange.SetUnderline(false); } catch(e) {}
                            try { clrRange.SetStrikeout(false); } catch(e) {}
                            try { clrRange.SetHighlight("none"); } catch(e) {}
                        }
                        if (target.paragraph) {
                            try { target.paragraph.SetBold(false); } catch(e) {}
                            try { target.paragraph.SetItalic(false); } catch(e) {}
                            try { target.paragraph.SetUnderline(false); } catch(e) {}
                            try { target.paragraph.SetStrikeout(false); } catch(e) {}
                            try { target.paragraph.SetHighlight("none"); } catch(e) {}
                        }
                        return { success: true, action: action, targetIndex: target.index };
                    }
                    return { success: false, error: "Target not located" };
                }

                return { success: true, action: action };
            } catch(runtimeErr) {
                return { success: false, error: runtimeErr.toString() };
            }
        }, false, true, function(result) {
            if (window.top) {
                window.top.postMessage({
                    type: "ONESCRIPT_ACTION_COMPLETED",
                    result: result
                }, "*");
            }
        });
    }

    // Direct cross-origin postMessage listener
    window.addEventListener("message", function(event) {
        var msg = event.data;
        if (!msg) return;

        if (typeof msg === "string") {
            try { msg = JSON.parse(msg); } catch(e) {}
        }

        if (msg.type === "ONESCRIPT_PING") {
            announceReady(event.source || window.top);
        } else if (msg.type === "ONESCRIPT_EXECUTE_ACTION") {
            console.log("[OneScript Bridge] Received action from host via postMessage:", msg.data);
            executeAction(msg.data);
        } else if (msg.type === "onExternalPluginMessage") {
            console.log("[OneScript Bridge] Received onExternalPluginMessage via window listener:", msg.data);
            executeAction(msg.data);
        }
    });

    // ONLYOFFICE plugin message fallback
    window.Asc.plugin.onExternalPluginMessage = function(message) {
        var data = message;
        if (typeof message === "string") {
            try { data = JSON.parse(message); } catch(e) {}
        }
        if (data && data.data) data = data.data;
        console.log("[OneScript Bridge] Received action via onExternalPluginMessage callback:", data);
        executeAction(data);
    };
})(window, undefined);
