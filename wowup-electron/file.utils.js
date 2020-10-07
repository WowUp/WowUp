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
Object.defineProperty(exports, "__esModule", { value: true });
exports.readFile = exports.readDirRecursive = void 0;
const fs = require("fs");
const path = require("path");
function readDirRecursive(sourcePath) {
    return __awaiter(this, void 0, void 0, function* () {
        return new Promise((resolve, reject) => {
            const dirFiles = [];
            fs.readdir(sourcePath, { withFileTypes: true }, (err, files) => __awaiter(this, void 0, void 0, function* () {
                if (err) {
                    return reject(err);
                }
                for (let file of files) {
                    const filePath = path.join(sourcePath, file.name);
                    if (file.isDirectory()) {
                        const nestedFiles = yield readDirRecursive(filePath);
                        dirFiles.push(...nestedFiles);
                    }
                    else {
                        dirFiles.push(filePath);
                    }
                }
                resolve(dirFiles);
            }));
        });
    });
}
exports.readDirRecursive = readDirRecursive;
function readFile(sourcePath) {
    return new Promise((resolve, reject) => {
        fs.readFile(sourcePath, { encoding: "utf-8" }, (err, data) => {
            if (err) {
                return reject(err);
            }
            return resolve(data);
        });
    });
}
exports.readFile = readFile;
//# sourceMappingURL=file.utils.js.map