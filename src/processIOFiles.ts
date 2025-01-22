import * as vscode from 'vscode';
import * as fs from 'fs';
import { TestCaseResult, Problem } from './types';
import { v4 as uuidv4 } from 'uuid';
import { getViewProvider } from './extension';

export const getTestCaseFromFile = async (inputFile: string | null, outputFile: string | null, problem: Problem) => {
    const id = uuidv4();
    let paramInputMap: Record<string, string> = {};
    for (const param of problem.parameters) {
        paramInputMap[param.paramName] = '';
    }

    let tcResult : TestCaseResult = {
        id,
        result: null,
        testcase: {
            input: '',
            output: '',
            paramInputMap,
            id,
        }
    };

    try {
        if (inputFile === null) {
            throw new Error('Please select an input file.');
        }
        else if (!fs.existsSync(inputFile)) {
            throw new Error('Input file does not exist.');
        }
        else {
            tcResult.testcase.input = fs.readFileSync(inputFile, 'utf8');
        }

        if (outputFile === null) {
            tcResult.testcase.output = '';
        }
        else if (!fs.existsSync(outputFile)) {
            throw new Error('Output file does not exist.');
        }
        else {
            tcResult.testcase.output = fs.readFileSync(outputFile, 'utf8');
        }

        getViewProvider().postMessageToWebview({
            command: 'update-file-testcase',
            tcResult,
        });
        vscode.window.showInformationMessage('Testcase added successfully.');
    }
    catch (error) {
        if (error instanceof Error) {
            vscode.window.showErrorMessage(error.message);
        }
    }
};