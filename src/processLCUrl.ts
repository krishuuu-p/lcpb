import { LeetCode } from 'leetcode-query';
import { Problem, TestCase } from './types';
import { checkUnsupported, getPreferenceFor } from './utilities';
import { parseCode } from './parseCode';
import { v4 as uuidv4 } from 'uuid'; 
import * as vscode from 'vscode';
import { getViewProvider } from './extension';
import * as fs from 'fs';
import path from 'path';
import { saveProblem } from './saveProblem';

interface ProblemDetails {
    [key: string]: any;
}

function format(text: string, isOutput: boolean): string {
    let ret = '';
    let flag = isOutput;

    for (let i = 0; i < text.length; i++) {
        if (flag && text[i] === '[' && text[i + 1] === '[') {
            // To handle nested arrays in i/o
            i++;
            let arr = '';
            while (!(text[i] === ']' && text[i + 1] === ']')) {
                if (text[i] === '[') {
                    let str = '';
                    i++;
                    while (text[i] !== ']') {
                        str += text[i] === ',' ? ' ' : text[i];
                        i++;
                    }
                    arr += '['+ str + ']';
                } else {
                    i++;
                }
            }
            flag = false;
            i++;
            ret += '[' + arr + ']';
        } else if (flag && text[i] === '[') {
            // To handle arrays in i/o
            let str = '';
            i++;
            while (text[i] !== ']') {
                str += text[i] === ',' ? ' ' : text[i];
                i++;
            }
            ret += '[' + str + ']';
            flag = false;
        } else if (flag) {
            // To handle simple numbers in i/o
            let str = '';
            while (i < text.length && text[i] !== ',') {
                str += text[i];
                i++;
            }
            if (i < text.length) {
                str += ',';
            }
            ret += str;
            flag = false;
        }
        else {
            ret += text[i];
        }

        if (text[i] === '=') {
            flag = true;
            i++;
            ret += ' ';
        }
    }

    return ret;
}

async function askWithTimeout<T>(
    question: string,
    timeoutMs: number,
    defaultValue: T,
    ...options: string[]
): Promise<T> {
    return new Promise<T>((resolve) => {
        const timer = setTimeout(() => resolve(defaultValue), timeoutMs);
        vscode.window.showInformationMessage(question, ...options).then((selection) => {
            clearTimeout(timer);
            resolve((selection as T) ?? defaultValue);
        });
    });
}

async function writeToFiles(problem: Problem) {
    const prefPath = getPreferenceFor('general.testcaseSaveLocation');
    const srcPath = problem.srcPath;
    if (prefPath === '') {
        if (!fs.existsSync(path.join(path.dirname(srcPath),'.lcpb'))) {
            try {
                await fs.promises.mkdir(path.join(path.dirname(srcPath),'.lcpb'));
            }
            catch (error) {
                console.error('Error creating .lcpb directory:', error);
                vscode.window.showErrorMessage('An unexpected error occurred while creating the .lcpb directory.');
            }

            try {
                await fs.promises.mkdir(path.join(path.dirname(srcPath),'.lcpb', 'testcases'));
            }
            catch (error) {
                console.error('Error creating testcases directory:', error);
                vscode.window.showErrorMessage('An unexpected error occurred while creating the testcases directory within .lcpb folder.');
            }
        }
        else if (!fs.existsSync(path.join(path.dirname(srcPath),'.lcpb', 'testcases'))) {
            try {
                await fs.promises.mkdir(path.join(path.dirname(srcPath),'.lcpb', 'testcases'));
            }
            catch (error) {
                console.error('Error creating testcases directory:', error);
                vscode.window.showErrorMessage('An unexpected error occurred while creating the testcases directory within .lcpb folder.');
            }
        }

        try {
            (problem.tests).forEach((test, index) => {
                const inputPath = path.join(path.dirname(srcPath),'.lcpb', 'testcases', `input_${index+1}_${problem.name.split(' ').join('_')}.txt`);
                const outputPath = path.join(path.dirname(srcPath),'.lcpb', 'testcases', `output_${index+1}_${problem.name.split(' ').join('_')}.txt`);
                fs.writeFileSync(inputPath, test.input);
                fs.writeFileSync(outputPath, test.output);
            });
    
            vscode.window.showInformationMessage('Input and output files have been written to the .lcpb\\testcases directory.');
        }
        catch (error) {
            console.error('Error writing inputs and outputs to files:', error);
            vscode.window.showErrorMessage('An unexpected error occurred while writing testcases to files.');
        }
    }
    else {
        if (!fs.existsSync(prefPath)) {
            vscode.window.showErrorMessage(`The preferred directory for saving fetched testcases ${prefPath} does not exist. (Check your settings)`);
        }
        else {
            try {
                (problem.tests).forEach((test, index) => {
                    const inputPath = path.join(prefPath, `input_${index+1}_${problem.name.split(' ').join('_')}.txt`);
                    const outputPath = path.join(prefPath, `output_${index+1}_${problem.name.split(' ').join('_')}.txt`);
                    fs.writeFileSync(inputPath, test.input);
                    fs.writeFileSync(outputPath, test.output);
                });
        
                vscode.window.showInformationMessage(`Input and output files have been written to ${prefPath}.`);
            }
            catch (error) {
                console.error('Error writing inputs and outputs to files:', error);
                vscode.window.showErrorMessage(`An unexpected error occurred while writing testcases to ${prefPath}.`);
            }
        }
    }
}

async function getAllProblemDetails(
    problemSlug: string,
): Promise<ProblemDetails | null> {
    const leetcode = new LeetCode();
    const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => {
            reject(new Error('Request timed out'));
        }, 20000);
    });

    let errorMessage = '';
    let probDetails: ProblemDetails | null = null;

    try {
        probDetails = (await Promise.race([
            leetcode.problem(problemSlug),
            timeoutPromise,
        ])) as ProblemDetails;

        if (!probDetails) {
            console.error('Cannot find matching LeetCode problem.');
            errorMessage = 'Cannot find matching LeetCode problem.';
        }
    } catch (error) {
        errorMessage =
            error instanceof Error && error.message === 'Request timed out'
                ? 'Connection timed out. Please check your internet connection and try again.'
                : 'An unexpected error occurred.';
        console.error('Error fetching problem details:', errorMessage);
    }

    if (errorMessage !== '') {
        getViewProvider().postMessageToWebview({
            command: 'error-from-extension',
            message: errorMessage,
        });
    }

    return probDetails;
}

// Extract problem slug from a LeetCode URL
const getProblemSlug = (url: string): string | null => {
    try {
        const parsedUrl = new URL(url);
        if (!url.startsWith('https://leetcode.com/problems/')) {
            throw new Error('Invalid LeetCode problem URL.');
        }
        const problemSlug = parsedUrl.pathname.split('/')[2];
        return problemSlug;
    } catch (error) {
        console.error('Invalid URL:', error);
        return null;
    }
};

async function handleNewLeetCodeProblem(
    probDetails: ProblemDetails,
    urlInput: string,
): Promise<{problem: Problem|undefined, code: string|null}> {
    if (!probDetails) {
        return {problem: undefined, code: null};
    }

    const editor = vscode.window.activeTextEditor;
    if (!editor) {
        checkUnsupported('');
        getViewProvider().postMessageToWebview({
            command: 'error-from-extension',
            message: 'An unexpected error occurred.',
        });
        return {problem: undefined, code: null};
    }

    const srcPath = editor.document.fileName;
    if (checkUnsupported(srcPath)) {
        getViewProvider().postMessageToWebview({
            command: 'error-from-extension',
            message: 'This file type is not supported.',
        });
        return {problem: undefined, code: null};
    }

    const extensionToIndexMap = new Map<string, number>([
        ['cpp', 0], ['java', 1], ['py', 2], ['py3', 3], ['c', 4],
        ['cs', 5], ['js', 6], ['ts', 7], ['php', 8], ['swift', 9],
        ['kt', 10], ['dart', 11], ['go', 12], ['rb', 13], ['scala', 14],
        ['rs', 15], ['rkt', 16], ['erl', 17], ['ex', 18],
    ]);

    const extension = srcPath.split('.').pop() || '';
    let index = extension ? extensionToIndexMap.get(extension) : undefined;

    if (index === undefined) {
        getViewProvider().postMessageToWebview({
            command: 'error-from-extension',
            message: 'This language is not supported by LeetCode.',
        });
        return {problem: undefined, code: null};
    }

    // Handle Python-specific language selection
    let language = extension;
    if (extension === 'py') {
        const pythonVersion = await askWithTimeout(
            'Select version of Python:',
            20000,
            'Python',
            'Python',
            'Python3'
        );
        language = pythonVersion === 'Python3' ? 'py3' : 'py';
        index = language === 'py3' ? 3 : 2;
     }

    // Parse the code to extract return type and parameters
    const code = probDetails.codeSnippets[index].code;
    const result = parseCode(code, language);
    const codeToWrite = result.code;

    let description: string = probDetails.content;

    let problem: Problem = {
        url: urlInput,
        name: probDetails.title,
        description,
        memoryLimit: 1024,
        timeLimit: 3000,
        tests: [],
        srcPath,
        language,
        returnType: result.parsedFunction.returnType,
        parameters: result.parsedFunction.parameters,
        functionName: result.parsedFunction.functionName,
    };

    const content = probDetails.content.replace(/&quot;/g, '');
    const testCases: TestCase[] = [];
    const inputs: string[] = [];
    const outputs: string[] = [];
    let paramInputMaps: Record<string, string>[] = [];

    const inputRegex =
        /<strong>Input:<\/strong>\s*(?:<span[^>]*>)?(.*?)(?=<\/span>|(?=\n)|(?=\+)|(?=<\/p>))/g;
    const outputRegex =
        /<strong>Output:<\/strong>\s*(?:<span[^>]*>)?(.*?)(?=<\/span>|(?=\n)|(?=\+)|(?=<\/p>))/g;

    let inputMatch: RegExpExecArray | null;
    while ((inputMatch = inputRegex.exec(content)) !== null) {
        let inputLine = inputMatch[1].trim();
        
        inputLine = format(inputLine, false);
        const params = inputLine.split(',').map(param => param.trim());

        const paramInputMap: Record<string, string> = {};
        let idx = 0;
        params.forEach(param => {
            const value = param.split('=')[1].trim();
            paramInputMap[problem.parameters[idx].paramName] = value;
            idx++;
        });

        paramInputMaps.push(paramInputMap);
        let input = '';
        for (const key in paramInputMap) {
            input += `${key}: ${paramInputMap[key]}\n`;
        }
        inputs.push(input);
    }

    let outputMatch: RegExpExecArray | null;
    while ((outputMatch = outputRegex.exec(content)) !== null) {
        if(outputMatch[1].trim().startsWith('<strong>Explanation:</strong>')) {
            outputs.push('');
        } else {
            outputs.push(format(outputMatch[1].trim(), true));
        }
    }

    for (let i = 0; i < Math.min(inputs.length, outputs.length); i++) {
        testCases.push({
            input: inputs[i],
            output: outputs[i],
            paramInputMap: paramInputMaps[i],
            id: uuidv4(),
        });
    }

    problem.tests = testCases;
    console.log('Problem:', problem);
    return {problem, code: codeToWrite};
}

async function getProblemFromSlug(
    problemSlug: string,
    urlInput: string,
): Promise<{problem: Problem|undefined, code: string|null}> {
    const probDetails = await getAllProblemDetails(problemSlug);
    if (!probDetails) {
        return {problem: undefined, code: null};
    }
    let {problem, code} = await handleNewLeetCodeProblem(probDetails, urlInput);

    return {problem, code};
}

// Fetch and return LeetCode problem details
export const getLeetcodeProblem = async (
    url: string,
): Promise<Problem | undefined> => {
    let errorMessage: string = '';
    let problem: Problem | undefined = undefined;
    let code: string | null = null;
    const problemSlug = getProblemSlug(url);

    if (!problemSlug) {
        console.error('Cannot fetch LeetCode Problem. Invalid URL.');
        errorMessage =
            'Invalid URL. Please provide a valid LeetCode problem URL.';
    } else {
        try {
            const result = await getProblemFromSlug(problemSlug, url);
            problem = result.problem;
            code = result.code;
        } catch (error) {
            console.error('Error fetching Leetcode Problem:', error);
            errorMessage =
                'An unexpected error occurred while fetching the problem.';
        }
    }
    if (errorMessage !== '') {
        getViewProvider().postMessageToWebview({
            command: 'error-from-extension',
            message: errorMessage,
        });
    }
    else {
        if (problem !== undefined) {
            if (getPreferenceFor('general.saveTestCases')) {
                writeToFiles(problem);
            }
            saveProblem(problem.srcPath, problem);
            getViewProvider().postMessageToWebview({
                command: 'update-problem',
                problem,
            });
            
            if (code) {
                const writeCode = await askWithTimeout(
                    'LCPB: Do you want to clear the current file content and replace it with the fetched code?',
                    20000,
                    'No',
                    'Yes',
                    'No'
                );

                if (writeCode === 'Yes') {
                    fs.writeFileSync(problem.srcPath, code);
                }
            }
        }
    }

    return problem;
};
