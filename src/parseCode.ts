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
            let listimportcode = '';
            let optionalimportcode = '';
            for (let i = 1; i < params.length; i++) {
                const parts = params[i].trim().split(':');
                const paramName = parts[0].trim();
                const paramType = parts[1].trim();
                if (paramType.startsWith('List[')) {
                    listimportcode = 'from typing import List\n\n';
                }
                else if (paramType.startsWith('Optional[') ) {
                    optionalimportcode = 'from typing import Optional\n\n';
                }
                extractedParams.push({paramType, paramName});
            }
            parsedFunction.parameters = extractedParams;
            if (parsedFunction.returnType.startsWith('List[')) {
                listimportcode = 'from typing import List\n\n';
            }
            else if (parsedFunction.returnType.startsWith('Optional[')) {
                optionalimportcode = 'from typing import Optional\n\n';
            }

            header = listimportcode + optionalimportcode;
        }
    }

    code = header + body;

    return {code, parsedFunction};
}

export function fillCode(code: string, problem: Problem, paramInputMap: Record<string, string>) {
    let newCode = '';
    const params = problem.parameters;
    const paramTypeMap: Record<string,string> = {};
    for (const {paramType, paramName} of params) {
        paramTypeMap[paramName] = paramType;
    }

    let constructTreeCode = '';
    let printLevelOrderCode = '';

    try {
        if (problem.language === 'cpp') {
            const singleType = ['int','long','long long','float','double','long double','string','uint32_t','uint64_t','bool','char'];
            const arrayType = ['vector<int>', 'vector<long>', 'vector<long long>', 'vector<float>', 'vector<double>', 'vector<long double>',
                'vector<string>', 'vector<uint32_t>', 'vector<uint64_t>', 'vector<boolean>', 'vector<char>'];
            const array2DType = ['vector<vector<int>>', 'vector<vector<long>>', 'vector<vector<long long>>', 'vector<vector<float>>', 
                'vector<vector<double>>', 'vector<vector<long double>>', 'vector<vector<string>>', 'vector<vector<uint32_t>>', 
                'vector<vector<uint64_t>>', 'vector<vector<boolean>>', 'vector<vector<char>>'];
            const pointerType = ['TreeNode*','Node*','ListNode*'];
            const pointerArrayType = ['vector<TreeNode*>','vector<Node*>','vector<ListNode*>'];
            
            for (const paramName of Object.keys(paramInputMap)) {
                const paramType = paramTypeMap[paramName];
                if (singleType.includes(paramType)) {
                    newCode += `\t${paramType} ${paramName};\n`;
                    newCode += `\tcin >> ${paramName};\n`;
                }
                else if (arrayType.includes(paramType)) {
                    newCode += `\tint ${paramName}_size; cin >> ${paramName}_size;\n`;
                    newCode += `\t${paramType} ${paramName}(${paramName}_size);\n`;
                    newCode += `\tfor (int i = 0; i < ${paramName}_size; i++) {\n`;
                    newCode += `\t\tcin >> ${paramName}[i];\n\t}\n`;
                }
                else if (array2DType.includes(paramType)) {
                    newCode += `\tint ${paramName}_size; cin >> ${paramName}_size;\n`;

                    newCode += `\t${paramType} ${paramName}(${paramName}_size);\n`;
                    newCode += `\tfor (int i = 0; i < ${paramName}_size; i++) {\n`;
                    newCode += `\t\tint ${paramName}_inner_size; cin >> ${paramName}_inner_size;\n`;
                    newCode += `\t\t${paramName}[i].resize(${paramName}_inner_size);\n`;
                    newCode += `\t\tfor (int j = 0; j < ${paramName}_inner_size; j++) {\n`;
                    newCode += `\t\t\tcin >> ${paramName}[i][j];\n\t\t}\n`;
                    newCode += '\t}\n';
                    
                }
                else if (paramType === 'TreeNode*') {
                    constructTreeCode += '\nTreeNode* constructTree(vector<int>& arr) {\n';
                    constructTreeCode += '\tif (arr.empty()) return nullptr;\n';
                    constructTreeCode += '\tTreeNode* root = new TreeNode(arr[0]);\n';
                    constructTreeCode += '\tqueue<TreeNode*> q;\n';
                    constructTreeCode += '\tq.push(root);\n';
                    constructTreeCode += '\tint i = 1;\n';
                    constructTreeCode += '\twhile (!q.empty() && i < arr.size()) {\n';
                    constructTreeCode += '\t\tTreeNode* node = q.front(); q.pop();\n';
                    constructTreeCode += '\t\tif (arr[i] != INT_MIN) {\n';
                    constructTreeCode += '\t\t\tnode->left = new TreeNode(arr[i]);\n';
                    constructTreeCode += '\t\t\tq.push(node->left);\n\t\t}\n';
                    constructTreeCode += '\t\ti++;\n';
                    constructTreeCode += '\t\tif (i < arr.size() && arr[i] != INT_MIN) {\n';
                    constructTreeCode += '\t\t\tnode->right = new TreeNode(arr[i]);\n';
                    constructTreeCode += '\t\t\tq.push(node->right);\n\t\t}\n';
                    constructTreeCode += '\t\ti++;\n\t}\n';
                    constructTreeCode += '\treturn root;\n}\n';
                    newCode += `\tvector<int> ${paramName}_arr;\n`;
                    newCode += `\tint ${paramName}_size; cin >> ${paramName}_size;\n`;
                    newCode += `\tfor (int i = 0; i < ${paramName}_size; i++) {\n`;
                    newCode += `\t\tstring val; cin >> val;\n`;
                    newCode += `\t\tif (val == "null") ${paramName}_arr.push_back(INT_MIN);\n`;
                    newCode += `\t\telse ${paramName}_arr.push_back(stoi(val));\n\t}\n`;
                    newCode += `\tTreeNode* ${paramName} = constructTree(${paramName}_arr);\n`;
                }
                else if (pointerType.includes(paramType) || pointerArrayType.includes(paramType)) {
                    throw new Error('Pointer type not supported yet. Consider writing the driver code on your own.');
                }
                else {
                    throw new Error('Parameter type not recognised. Consider writing the driver code on your own.');
                }
            }
            const returnType = problem.returnType;
            
            if (returnType === 'void') {
                throw new Error('Cannot verify output of function with return type void. Consider writing the driver code on your own.');
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
                    newCode += `\tcout<<'[';\n`;
                    newCode += `\tfor (int i = 0; i < res.size(); i++) {\n`;
                    newCode += `\t\tcout << res[i] ; if (i != res.size() - 1) cout << " " ;\n\t}\n`;
                    newCode += `\tcout<<']'<<endl;\n`;
                }
                else if (array2DType.includes(returnType)) {
                    newCode += `\tcout<<'[';\n`;
                    newCode += `\tfor (int i = 0; i < res.size(); i++) {\n`;
                    newCode += `\t\tcout << '[';\n`;
                    newCode += `\t\tfor (int j = 0; j < res[i].size(); j++) {\n`;
                    newCode += `\t\t\tcout << res[i][j] ;\n\t\t\tif (j != res[i].size() - 1) cout << " " ;\n\t\t}\n`;
                    newCode += `\t\tcout << ']';\n\t}\n`;
                    newCode += `\tcout<<']'<<endl;\n`;
                }
                else if (returnType === 'TreeNode*') {
                    printLevelOrderCode = '\nvoid printLevelOrder(TreeNode* root) {\n';
                    printLevelOrderCode += '\tif (!root) return;\n';
                    printLevelOrderCode += '\tvector<int> res;\n';
                    printLevelOrderCode += '\tqueue<TreeNode*> q;\n';
                    printLevelOrderCode += '\tq.push(root);\n';
                    printLevelOrderCode += '\twhile (!q.empty()) {\n';
                    printLevelOrderCode += '\t\tTreeNode* current = q.front();\n';
                    printLevelOrderCode += '\t\tq.pop();\n';
                    printLevelOrderCode += '\t\tif (current) {\n';
                    printLevelOrderCode += '\t\t\tres.push_back(current->val);\n';
                    printLevelOrderCode += '\t\t\tq.push(current->left);\n';
                    printLevelOrderCode += '\t\t\tq.push(current->right);\n\t\t}';
                    printLevelOrderCode += '\t\t else {\n';
                    printLevelOrderCode += '\t\t\tres.push_back(INT_MIN);\n\t\t}\n\t}\n';
                    printLevelOrderCode += '\tfor (int i = res.size() - 1; i >= 0; i--) {\n';
                    printLevelOrderCode += '\t\tif (res[i] == INT_MIN) res.pop_back();\n';
                    printLevelOrderCode += '\t\telse break;\n\t}\n';

                    printLevelOrderCode += `\tcout<<'[';\n`;
                    printLevelOrderCode += `\tfor (int i = 0; i < res.size(); i++) {\n`;
                    printLevelOrderCode += `\t\tcout << (res[i] == INT_MIN ? "null" : to_string(res[i])) ; if (i != res.size() - 1) cout << " " ;\n\t}\n`;
                    printLevelOrderCode += `\tcout<<']'<<endl;\n}\n`;

                    newCode += `\tprintLevelOrder(res);\n`;
                }
                else if (pointerType.includes(returnType) || pointerArrayType.includes(returnType)) {
                    throw new Error(`Pointer return type ${returnType} not supported yet. Consider writing the driver code on your own.`);
                }
                else {
                    throw new Error(`Return type: ${returnType} not recognised. Consider writing the driver code on your own.`);
                }
            }

            newCode = code + constructTreeCode + printLevelOrderCode + '\nint main() {\n\tSolution obj;\n' + newCode + '\n\treturn 0;\n}';
        }
        else if (problem.language === 'py' || problem.language === 'py3') {
            let importCode = '';
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
                }
                else if (arrayType.includes(paramType)) {
                    newCode += `${paramName}_size = int(input())\n`;
                    const innerType = paramType.slice(5,-1);
                    if (innerType === 'str') {
                        newCode += `${paramName} = list(input().split())\n`;
                    } else {
                        newCode += `${paramName} = list(map(${innerType}, input().split()))\n`;
                    }
                }
                else if (array2DType.includes(paramType)) {
                    newCode += `${paramName}_size = int(input())\n`;
                    const innerType = paramType.slice(10,-2);
                    newCode += `${paramName} = []\n`;
                    newCode += `for _ in range(${paramName}_size):\n`;
                    newCode += `\t${paramName}_inner_size = int(input())\n`;
                    if(innerType === 'str') {
                        newCode += `\t${paramName}.append(list(input().split()))\n`;
                    } else {
                        newCode += `\t${paramName}.append(list(map(${innerType}, input().split())))\n`;
                    }
                }
                else if (paramType === 'TreeNode' || paramType === 'Optional[TreeNode]') {
                    importCode += 'from collections import deque\n';
                    constructTreeCode = `def construct_tree(level_order):
    if not level_order:
        return None

    root = TreeNode(level_order[0])
    queue = deque([root])
    i = 1  # Pointer to traverse the level_order list

    while queue and i < len(level_order):
        current = queue.popleft()

        if level_order[i] is not None:
            current.left = TreeNode(level_order[i])
            queue.append(current.left)
        i += 1

        if i < len(level_order) and level_order[i] is not None:
            current.right = TreeNode(level_order[i])
            queue.append(current.right)
        i += 1

    return root
`;
                    newCode += `${paramName}_size = int(input())\n`;
                    newCode += `${paramName}_arr = []\n`;
                    newCode += `if ${paramName}_size != 0:\n`;
                    newCode += `\t${paramName}_arr = [None if val == 'null' else int(val) for val in input().split()]\n`;
                    newCode += `${paramName} = construct_tree(${paramName}_arr)\n`;
                }

                else if (pointerType.includes(paramType) || pointerArrayType.includes(paramType)) {
                    throw new Error('Pointer type not supported yet. Consider writing the driver code on your own.');
                }
                else {
                    throw new Error('Parameter type not recognised. Consider writing the driver code on your own.');
                }
            }

            const returnType = problem.returnType;

            if (returnType === 'None') {
                throw new Error('Cannot verify output of a function with return type None. Consider writing the driver code on your own.');
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
                if (returnType === 'bool') {
                    newCode += `if (res):\n\tprint("true",end="")\n`;
                    newCode += `else:\n\tprint("false",end="")\n`;
                }
                else if (singleType.includes(returnType)) {
                    newCode += `print(res)\n`;
                }
                else if (arrayType.includes(returnType)) {
                    newCode += 'print("[", end="")\n';
                    newCode += 'print(" ".join(map(str, res)), end="")\n';
                    newCode += 'print("]")\n';
                }
                else if (array2DType.includes(returnType)) {
                    newCode += 'print("[", end="")\n';
                    newCode += `for row in res:\n`;
                    newCode += '\tprint("[", end="")\n';
                    newCode += '\tprint(" ".join(map(str, row)), end="")\n';
                    newCode += '\tprint("]", end="")\n';
                    newCode += 'print("]")\n';
                }
                else if (returnType === 'TreeNode' || returnType === 'Optional[TreeNode]') {
                    if (importCode === '') {
                        importCode += 'from collections import deque\n';
                    }
                    printLevelOrderCode = `def print_level_order(root):
    if not root:
        return
    queue = deque([root])
    res = []
    while queue:
        current = queue.popleft()
        if current:
            res.append(current.val)
            queue.append(current.left)
            queue.append(current.right)
        else:
            res.append("null")

    while res[-1] == "null":
        res.pop()
    
    print("[", end="")
    for i in range(len(res)):
        if i != len(res) - 1:
            print(res[i], end=" ")
        else:
            print(res[i],end="")
    print("]")
    \n`;

                    newCode += `print_level_order(res)\n`;
                }
                else if (pointerType.includes(returnType) || pointerArrayType.includes(returnType)) {
                    throw new Error(`Pointer return type: ${returnType} not supported yet. Consider writing the driver code on your own.`);
                }
                else {
                    throw new Error(`Return type: ${returnType} not recognised. Consider writing the driver code on your own.`);
                }
            }

            newCode = importCode + code + constructTreeCode + printLevelOrderCode + '\nsolution = Solution()\n' + newCode;
        }
    } catch (e) {
        if (e instanceof Error) {
            vscode.window.showErrorMessage(e.message);
        }

        return code;
    }

    return newCode;
}

export function inputToStdin(paramInputMap: Record<string,string>, problem: Problem): string|null {
    let stdInput = '';
    const params = problem.parameters;
    const paramTypeMap: Record<string,string> = {};
    for (const {paramType, paramName} of params) {
        paramTypeMap[paramName] = paramType;
    }

    let singleType: string[] = [];
    let arrayType: string[] = [];
    let array2DType: string[] = [];
    let pointerType: string[] = [];
    let pointerArrayType: string[] = [];

    try {
        if (problem.language === 'cpp') {
            singleType = ['int','long','long long','float','double','long double','string','uint32_t','uint64_t','bool','char'];
            arrayType = ['vector<int>', 'vector<long>', 'vector<long long>', 'vector<float>', 'vector<double>', 'vector<long double>',
                'vector<string>', 'vector<uint32_t>', 'vector<uint64_t>', 'vector<boolean>', 'vector<char>'];
            array2DType = ['vector<vector<int>>', 'vector<vector<long>>', 'vector<vector<long long>>', 'vector<vector<float>>', 
                'vector<vector<double>>', 'vector<vector<long double>>', 'vector<vector<string>>', 'vector<vector<uint32_t>>', 
                'vector<vector<uint64_t>>', 'vector<vector<boolean>>', 'vector<vector<char>>'];
            pointerType = ['TreeNode*','Node*','ListNode*'];
            pointerArrayType = ['vector<TreeNode*>','vector<Node*>','vector<ListNode*>'];
        }
        else if (problem.language === 'py' || problem.language === 'py3') {
            singleType = ['int','float','str','bool'];
            arrayType = ['List[int]', 'List[float]', 'List[str]', 'List[bool]'];
            array2DType = ['List[List[int]]', 'List[List[float]]', 'List[List[str]]', 'List[List[bool]]'];
            pointerType = ['TreeNode','Node','ListNode', 'Optional[TreeNode]', 'Optional[Node]', 'Optional[ListNode]'];
            pointerArrayType = ['List[TreeNode]','List[Node]','List[ListNode]', 'List[Optional[TreeNode]]', 'List[Optional[Node]]', 'List[Optional[ListNode]]'];
        }
        else {
            throw new Error(`Unsupported language ${problem.language}`);
        }

        for (const [paramName, input] of Object.entries(paramInputMap)) {
            const paramType = paramTypeMap[paramName];
            if (singleType.includes(paramType)) {
                stdInput += input + '\n';
            } else if (arrayType.includes(paramType) || (paramType === 'TreeNode*' && problem.language === 'cpp')  || 
                ((paramType === 'TreeNode' || paramType === 'Optional[TreeNode]') && (problem.language === 'py' || problem.language === 'py3'))) 
            {
                if (input[0] !== '[' || input[input.length-1] !== ']') {
                    throw new Error(`Invalid input format for ${paramName}. Expected ${paramName} in the format [...]`);
                }
                const arr = input.slice(1,-1).split(' ').map((x) => x.trim());
                if (arr.length === 1 && arr[0] === '') {
                    stdInput += '0\n';
                } else {
                    stdInput += arr.length + '\n' + input.slice(1,-1).trim() + '\n';
                }
            } else if (array2DType.includes(paramType)) {
                if (!input.startsWith('[[') || !input.endsWith(']]')) {
                    throw new Error(`Invalid input format for ${paramName}. Expected ${paramName} in the format [[][]...]`);
                }
                const arr = input.slice(2,-2).split('][').map((x) => x.trim());
                stdInput += arr.length + '\n';
                for (const subArr of arr) {
                    const subArrElements = subArr.split(' ').map((x) => x.trim());
                    stdInput += subArrElements.length + '\n' + subArrElements.join(' ') + '\n';
                }
            } else if (pointerType.includes(paramType) || pointerArrayType.includes(paramType)) {
                throw new Error(`Pointer type (${paramType} ${paramName}) not supported yet. Consider writing the driver code on your own.`);
            } else {
                throw new Error(`Unsupported type ${paramType} for ${paramName}`);
            }
        }

        return stdInput;
    }
    catch (err) {
        console.error("Error occurred while converting input to stdin:", err);
        if (err instanceof Error) {
            vscode.window.showErrorMessage(err.message);
        } else {
            vscode.window.showErrorMessage(String(err));
        }

        return null;
    }
}