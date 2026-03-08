"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
Object.defineProperty(exports, "__esModule", { value: true });
var dotenv_1 = require("dotenv");
dotenv_1.default.config({ path: '.env.local' });
var supabase_js_1 = require("@supabase/supabase-js");
var supabaseUrl = process.env.VITE_SUPABASE_URL || '';
var supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || '';
var adguardUrl = process.env.ADGUARD_API_URL;
var adguardUser = process.env.ADGUARD_USERNAME;
var adguardPass = process.env.ADGUARD_PASSWORD;
console.log("Supabase e Adguard ENVs validadas:", !!supabaseUrl, !!adguardUrl);
var supabase = (0, supabase_js_1.createClient)(supabaseUrl, supabaseKey);
function runDevCheck() {
    return __awaiter(this, void 0, void 0, function () {
        var nets, clientId, ipValidToTest, token, agRes, agData, allLogs, extractIp_1, ipsValidSet_1, isClientMatch_1, matchedLogs;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, supabase.from('client_networks').select('client_id, value').limit(1)];
                case 1:
                    nets = (_a.sent()).data;
                    if (!nets || nets.length === 0) {
                        console.log("Nenhum client_network encontrado.");
                        return [2 /*return*/];
                    }
                    clientId = nets[0].client_id;
                    ipValidToTest = nets[0].value;
                    console.log("\n\n--- INICIANDO TESTE DO CLIENTE ".concat(clientId, " com IP ").concat(ipValidToTest, " ---"));
                    token = Buffer.from("".concat(adguardUser, ":").concat(adguardPass)).toString('base64');
                    return [4 /*yield*/, fetch("".concat(adguardUrl, "/control/querylog?limit=1000"), {
                            method: 'GET',
                            headers: { 'Authorization': "Basic ".concat(token), 'Accept': 'application/json' }
                        })];
                case 2:
                    agRes = _a.sent();
                    return [4 /*yield*/, agRes.json()];
                case 3:
                    agData = _a.sent();
                    allLogs = agData.data || [];
                    console.log("Logs brutos do AdGuard extra\u00EDdos: ".concat(allLogs.length));
                    if (allLogs.length > 0) {
                        console.log("\nRAW SAMPLE (1º log do adguard):\n", JSON.stringify(allLogs[0], null, 2));
                        extractIp_1 = function (clientStr) {
                            if (!clientStr)
                                return '';
                            var ipMatch = clientStr.match(/\b(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\b/);
                            if (ipMatch)
                                return ipMatch[0];
                            var parenMatch = clientStr.match(/\((.*?)\)/);
                            if (parenMatch && parenMatch[1])
                                return parenMatch[1].trim();
                            return clientStr.trim();
                        };
                        ipsValidSet_1 = new Set([ipValidToTest]);
                        console.log("\n--- TESTANDO EXTRAÇÃO DE IP DOS 5 PRIMEIROS LOGS ---");
                        allLogs.slice(0, 5).forEach(function (log, idx) {
                            var rawClient = log.client;
                            var extracted = extractIp_1(log.client);
                            console.log("[Item ".concat(idx, "] Raw client: ").concat(rawClient, " -> IP Extra\u00EDdo: ").concat(extracted));
                        });
                        isClientMatch_1 = function (log, ips) {
                            var clientFieldValue = log.client || '';
                            var clientIpFieldValue = log.client_ip || '';
                            var extractedIp = extractIp_1(clientFieldValue);
                            for (var _i = 0, _a = Array.from(ips); _i < _a.length; _i++) {
                                var validIp = _a[_i];
                                if (validIp === clientIpFieldValue ||
                                    validIp === extractedIp ||
                                    validIp === clientFieldValue ||
                                    clientFieldValue.includes(validIp)) {
                                    return true;
                                }
                            }
                            return false;
                        };
                        matchedLogs = allLogs.filter(function (log) { return isClientMatch_1(log, ipsValidSet_1); });
                        console.log("\nTotal Final: O cliente ".concat(ipValidToTest, " teve MATCH com ").concat(matchedLogs.length, " reqs de um total de ").concat(allLogs.length));
                        if (matchedLogs.length > 0) {
                            console.log("\nDados de Telemetria Finais:");
                            console.log("- Status: ATIVO");
                            console.log("- Último acesso:", matchedLogs[0].time);
                        }
                    }
                    return [2 /*return*/];
            }
        });
    });
}
runDevCheck();
