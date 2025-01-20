import { ParsedFunction, Problem } from "./types";
import { getPreferenceFor } from "./utilities";
import * as vscode from 'vscode';
import * as fs from 'fs';

function parseFunctionSignature(functionSignature: string, language: string) {
    let returnType = '';
    let functionName = '';
    let extractedParams: { paramType: string; paramName: string }[] = [];
    
    const beforeParen = functionSignature.split('(')[0].split(' ');
    functionName = beforeParen[beforeParen.length - 1];
    returnType = functionSignature.split('(')[0].trim().split(' ').slice(0, -1).join(' ');
    const params = functionSignature.split('(')[1].split(')')[0].split(',');
    for (let param of params) {
        param = param.trim();
        const lastSpaceIndex = param.lastIndexOf(' ');
        if (lastSpaceIndex === -1) {
            throw new Error(`Invalid parameter format: ${param}`);
        }

        let paramType = param.slice(0, lastSpaceIndex);
        if (paramType.endsWith('&')) {
            paramType = paramType.split('&')[0];
        }
        const paramName = param.slice(lastSpaceIndex + 1);

        extractedParams.push({ paramType, paramName });
    }

    return {
        returnType,
        functionName,
        parameters: extractedParams,
    };
}

function extractFunctionSignature(code: string, language: string) {
    const lines = code.split('\n');
    let inClassSolution = false;
    let functionSignature = '';

    for (let line of lines) {
        if (line.trim().startsWith('class Solution')) {
            inClassSolution = true;
        }
        if (inClassSolution && line.startsWith('    ')) {
            functionSignature += line.trim();
            functionSignature = functionSignature.replace(' {', '');
            break;
        }
    }

    return functionSignature;
}

export function parseCode(code: string, language: string) {
    let header = '';
    let body = '';

    let parsedFunction: ParsedFunction = {
        returnType: '',
        functionName: '',
        parameters: [],
    };
    const lines = code.split('\n');

    if (language === 'cpp') {
        const templateFileLocation = getPreferenceFor('general.templateFileLocationCpp');
        let templateCode = '';
        if (templateFileLocation !== '') {
            if (!fs.existsSync(templateFileLocation)) {
                vscode.window.showErrorMessage('Template file does not exist');
            }
            else {
                if(templateFileLocation.endsWith('.cpp')) {
                    templateCode = fs.readFileSync(templateFileLocation, 'utf8');
                    vscode.window.showInformationMessage('Template file loaded successfully from ' + templateFileLocation);
                } else {
                    vscode.window.showErrorMessage('Invalid template file format for C++. Check settings.');
                }
            }
        }

        if(templateCode === '') {
            header = '#include <bits/stdc++.h>\nusing namespace std;\n\n';
        }
        else {
            header = templateCode + '\n';
        }

        let inDeclaration = false;
        let inComment = false;

        for (let line of lines) {
            if (line.trim().startsWith('*/')) {
                if (line.startsWith(' ')) {line = line.slice(3);}
                else {line = line.slice(2);}
            }

            if (inDeclaration) {
                if (line.trim().startsWith('* ')) {
                    line = line.slice(3);
                }
                body += `${line}\n`;
                if (line.trim().startsWith('};')) {
                    inDeclaration = false;
                }
            } else if (
                line.trim().startsWith('* class ') ||
                line.trim().startsWith('* struct ') ||
                line.trim().startsWith('class ') ||
                line.trim().startsWith('struct ')
            ) {
                inDeclaration = true;
                if (inComment) {
                    body += '*/\n';
                    inComment = false;
                }
                if (line.trim().startsWith('* ')) {
                    line = line.slice(3);
                }
                body += `${line}\n`;
            } else if (line.trim().startsWith('/*')) {
                inComment = true;
                body += `${line}\n`;
            } else {
                body += `${line}\n`;
            }
        }

        const functionSignature = extractFunctionSignature(code, language);
        parsedFunction = parseFunctionSignature(functionSignature, language);
    } 
    else if (language === 'py' || language === 'py3') {
        const templateFileLocation = getPreferenceFor('general.templateFileLocationPython');
        let templateCode = '';
        if (templateFileLocation !== '') {
            if (!fs.existsSync(templateFileLocation)) {
                vscode.window.showErrorMessage('Template file does not exist');
            }
            else {
                if(templateFileLocation.endsWith('.py')) {
                    templateCode = fs.readFileSync(templateFileLocation, 'utf8');
                    vscode.window.showInformationMessage('Template file loaded successfully from ' + templateFileLocation);
                } else {
                    vscode.window.showErrorMessage('Invalid template file format for Python/Python3. Check settings.');
                }
            }
        }

        if (templateCode !== '') {
            header = templateCode + '\n';
        }

        let functionSignature = '';
        let classSolIndex = -1;
        
        if (lines[0].trim().startsWith('\"\"\"')) {
            let inOtherClass = false;
            let inClassSolution = false;
            lines.forEach((line, index) => {
                if (line.trim().startsWith('class Solution')) {
                    inClassSolution = true;
                    classSolIndex = index;
                }
                if (line.trim().startsWith('class') && !line.trim().startsWith('class Solution')) {
                    inOtherClass = true;
                    body += '\"\"\"\n';
                    body += `${line}\n`;
                } else if (inOtherClass) {
                    if (line.trim().startsWith('\"\"\"')) {
                        inOtherClass = false;
                    } else {
                        body += `${line}\n`;
                    }
                } else {
                    body += `${line}\n`;
                }
            });
        }
        else {
            let inOtherClass = false;
            lines.forEach((line, index) => {
                if (line.trim().startsWith('# class')) {
                    inOtherClass = true;
                    line = line.trim().slice(2);
                    body += `${line}\n`;
                } else if (line.trim().startsWith('class Solution')) {
                    inOtherClass = false;
                    body += `${line}\n`;
                    classSolIndex = index;
                } else if (inOtherClass) {
                    line = line.trim().slice(2);
                    body += `${line}\n`;
                } else {
                    body += `${line}\n`;
                }
            });
        }

        let extractedParams: { paramType: string; paramName: string }[] = [];
        if (language === 'py') {
            for (let i = classSolIndex; i < lines.length; i++) {
                if (lines[i].trim().startsWith('def')) {
                    parsedFunction.functionName = lines[i].trim().split(' ')[1].split('(')[0];
                } 
                else if (lines[i].trim().startsWith(':type')) {
                    const parts = lines[i].trim().split(' ');
                    const paramName = parts[1].slice(0, -1);
                    const paramType = parts[2];
                    extractedParams.push({paramType, paramName});
                } 
                else if (lines[i].trim().startsWith(':rtype')) {
                    const parts = lines[i].trim().split(' ');
                    parsedFunction.returnType = parts[1];
                }
            }
            parsedFunction.parameters = extractedParams;
        } else {
            for (let i = classSolIndex; i < lines.length; i++) {
                if (lines[i].trim().startsWith('def')) {
                    functionSignature = lines[i].trim();
                    break;
                }
            }

            parsedFunction.functionName = functionSignature.split(' ')[1].split('(')[0];
            parsedFunction.returnType = functionSignature.split('->')[1].trim().slice(0, -1);
            const params = functionSignature.split('(')[1].split(')')[0].split(',');
            for (let i = 1; i < params.length; i++) {
                const parts = params[i].trim().split(':');
                const paramName = parts[0].trim();
                const paramType = parts[1].trim();
                if (paramType.startsWith('List[') && header === '') {
                    header = 'from typing import List\n\n';
                }
                extractedParams.push({paramType, paramName});
            }
            parsedFunction.parameters = extractedParams;
            if (header === '' && parsedFunction.returnType.startsWith('List[')) {
                header = 'from typing import List\n\n';
            }
        }
    }

    code = header + body;

    return {code, parsedFunction};
}

export function fillCode(code: string, inputLines: string[], problem: Problem) {
    let newCode = '';
    const params = problem.parameters;
    let idx = 0;
    let didError = false;

    if (problem.language === 'cpp') {
        const singleType = ['int','long','long long','float','double','long double','string','uint32_t','uint64_t','bool','char'];
        const arrayType = ['vector<int>', 'vector<long>', 'vector<long long>', 'vector<float>', 'vector<double>', 'vector<long double>',
             'vector<string>', 'vector<uint32_t>', 'vector<uint64_t>', 'vector<boolean>', 'vector<char>'];
        const array2DType = ['vector<vector<int>>', 'vector<vector<long>>', 'vector<vector<long long>>', 'vector<vector<float>>', 
            'vector<vector<double>>', 'vector<vector<long double>>', 'vector<vector<string>>', 'vector<vector<uint32_t>>', 
            'vector<vector<uint64_t>>', 'vector<vector<boolean>>', 'vector<vector<char>>'];
        const pointerType = ['TreeNode*','Node*','ListNode*'];
        const pointerArrayType = ['vector<TreeNode*>','vector<Node*>','vector<ListNode*>'];
        
        for (const {paramType, paramName} of params) {
            if (singleType.includes(paramType)) {
                newCode += `\t${paramType} ${paramName};\n`;
                newCode += `\tcin >> ${paramName};\n`;
                idx++;
            }
            else if (arrayType.includes(paramType)) {
                const size = inputLines[idx].split(' ').length;
                newCode += `\t${paramType} ${paramName}(${size});\n`;
                newCode += `\tint ${paramName}_size = ${size};\n`;
                newCode += `\tfor (int i = 0; i < ${paramName}_size; i++) {\n`;
                newCode += `\t\tcin >> ${paramName}[i];\n\t}\n`;
                idx++;
            }
            else if (array2DType.includes(paramType)) {
                if (inputLines[idx]!=='[') {
                    didError = true;
                    vscode.window.showErrorMessage('Invalid input format');
                    break;
                }
                else {
                    idx++;
                    const size = inputLines.slice(idx).findIndex((line) => line === ']');
                    if (size === -1) {
                        didError = true;
                        vscode.window.showErrorMessage('Invalid input format');
                        break;
                    }

                    newCode += `\t${paramType} ${paramName}(${size});\n`;
                    newCode += `\tint ${paramName}_size = ${size};\n`;
                    newCode += `\tfor (int i = 0; i < ${paramName}_size; i++) {\n`;
                    newCode += `\t\tint ${paramName}_inner_size; cin >> ${paramName}_inner_size;\n`;
                    newCode += `\t\t${paramName}[i].resize(${paramName}_inner_size);\n`;
                    newCode += `\t\tfor (int j = 0; j < ${paramName}_inner_size; j++) {\n`;
                    newCode += `\t\t\tcin >> ${paramName}[i][j];\n\t\t}\n`;
                    newCode += '\t}\n';

                    while (idx < inputLines.length && inputLines[idx] !== ']') {
                        idx++;
                    }
                    idx++;
                }
            }
            else if (pointerType.includes(paramType) || pointerArrayType.includes(paramType)) {
                didError = true;
                vscode.window.showErrorMessage('Pointer type not supported yet. Consider writing the driver code on your own.');
                break;
            }
            else {
                didError = true;
                vscode.window.showErrorMessage('Parameter type not recognised. Consider writing the driver code on your own.');
                break;
            }
        }
        
        if (!didError) {
            const returnType = problem.returnType;
            if (returnType === 'void') {
                didError = true;
                vscode.window.showErrorMessage('Cannot verify output of function with return type void. Consider writing the driver code on your own.');
            }
            else {
                newCode += '\n\t';
                newCode += `${problem.returnType} res = `;

                newCode += `obj.${problem.functionName}(`;
                params.forEach((param, index) => {
                    newCode += `${param.paramName}`;
                    if (index !== params.length - 1) {
                        newCode += ', ';
                    }
                });
                newCode += ');\n';

                if (returnType === 'bool') {
                    newCode += '\tcout << boolalpha << res << endl;\n';
                }
                else if (singleType.includes(returnType)) {
                    newCode += `\tcout << res << endl;\n`;
                }
                else if (arrayType.includes(returnType)) {
                    newCode += `\tfor (int i = 0; i < res.size(); i++) {\n`;
                    newCode += `\t\tcout << res[i] << " ";\n\t}\n`;
                }
                else if (array2DType.includes(returnType)) {
                    newCode += `\tfor (int i = 0; i < res.size(); i++) {\n`;
                    newCode += `\t\tfor (int j = 0; j < res[i].size(); j++) {\n`;
                    newCode += `\t\t\tcout << res[i][j] << " ";\n\t\t}\n`;
                    newCode += `\t\tcout << endl;\n\t}\n`;
                }
                else if (pointerType.includes(returnType) || pointerArrayType.includes(returnType)) {
                    didError = true;
                    vscode.window.showErrorMessage('Pointer type not supported yet. Consider writing the driver code on your own.');
                }
                else {
                    didError = true;
                    vscode.window.showErrorMessage('Return type not recognised. Consider writing the driver code on your own.');
                }
            }

            if (!didError) {
                newCode = code + '\nint main() {\n\tSolution obj;\n' + newCode + '\n\treturn 0;\n}';
            }
        }
    }
    else if (problem.language === 'py' || problem.language === 'py3') {
        const singleType = ['int','float','str','bool'];
        const arrayType = ['List[int]', 'List[float]', 'List[str]', 'List[bool]'];
        const array2DType = ['List[List[int]]', 'List[List[float]]', 'List[List[str]]', 'List[List[bool]]'];
        const pointerType = ['TreeNode','Node','ListNode', 'Optional[TreeNode]', 'Optional[Node]', 'Optional[ListNode]'];
        const pointerArrayType = ['List[TreeNode]','List[Node]','List[ListNode]', 'List[Optional[TreeNode]]', 'List[Optional[Node]]', 'List[Optional[ListNode]]'];

        for (const {paramType, paramName} of params) {
            if (singleType.includes(paramType)) {
                if (paramType === 'str') {
                    newCode += `${paramName} = input()\n`;
                }
                else {
                    newCode += `${paramName} = ${paramType}(input())\n`;
                }
                idx++;
            }
            else if (arrayType.includes(paramType)) {
                const innerType = paramType.slice(5,-1);
                if (innerType === 'str') {
                    newCode += `${paramName} = list(input().split())\n`;
                } else {
                    newCode += `${paramName} = list(map(${innerType}, input().split()))\n`;
                }
                idx++;
            }
            else if (array2DType.includes(paramType)) {
                if (inputLines[idx]!=='[') {
                    didError = true;
                    vscode.window.showErrorMessage('Invalid input format');
                    break;
                }
                else {
                    idx++;
                    const size = inputLines.slice(idx).findIndex((line) => line === ']');
                    if (size === -1) {
                        didError = true;
                        vscode.window.showErrorMessage('Invalid input format');
                        break;
                    }
                    const innerType = paramType.slice(10,-2);
                    newCode += `${paramName} = []\n`;
                    newCode += `for _ in range(${size}):\n`;
                    if(innerType === 'str') {
                        newCode += `\t${paramName}.append(list(input().split()))\n`;
                    } else {
                        newCode += `\t${paramName}.append(list(map(${innerType}, input().split())))\n`;
                    }

                    while (idx < inputLines.length && inputLines[idx] !== ']') {
                        idx++;
                    }
                    idx++;
                }
            }
            else if (pointerType.includes(paramType) || pointerArrayType.includes(paramType)) {
                didError = true;
                vscode.window.showErrorMessage('Pointer type not supported yet. Consider writing the driver code on your own.');
                break;
            }
            else {
                didError = true;
                vscode.window.showErrorMessage('Parameter type not recognised. Consider writing the driver code on your own.');
                break;
            }
        }

        if (!didError) {
            const returnType = problem.returnType;
            if (returnType === 'None') {
                didError = true;
                vscode.window.showErrorMessage('Cannot verify output of a function with return type None. Consider writing the driver code on your own.');
            }
            else if (pointerType.includes(returnType) || pointerArrayType.includes(returnType)) {
                didError = true;
                vscode.window.showErrorMessage('Pointer type not supported yet. Consider writing the driver code on your own.');
            }
            else if (!(singleType.includes(returnType) || arrayType.includes(returnType) || array2DType.includes(returnType))) {
                didError = true;
                vscode.window.showErrorMessage('Return type not recognised. Consider writing the driver code on your own.');
            }
            else {
                newCode += '\n';
                newCode += `res = solution.${problem.functionName}(`;
                params.forEach((param, index) => {
                    newCode += param.paramName;
                    if (index !== params.length - 1) {
                        newCode += ', ';
                    }
                });
                newCode += ')\n';
                if (singleType.includes(returnType)) {
                    newCode += `print(res)\n`;
                }
                else if (arrayType.includes(returnType)) {
                    newCode += 'print(" ".join(map(str, res)))';
                }
                else if (array2DType.includes(returnType)) {
                    newCode += `for row in res:\n`;
                    newCode += '\tprint(" ".join(map(str, row)))\n';
                }


                newCode = code + '\nsolution = Solution()\n' + newCode;
            }
        }
    }

    if (didError) {
        newCode = code;
    }

    return newCode;
}