import { Problem, RunResult, TestResult } from "./types";
import * as fs from "fs";
import * as path from "path";
import * as vscode from "vscode";
import { getViewProvider } from "./extension";
import kill from "tree-kill";
import { spawn } from "child_process";
import { fillCode } from "./parseCode";
import { getPreferenceFor } from "./utilities";

const outputChannel = vscode.window.createOutputChannel("Code Execution");

const getSingleRunResult = async (input: string, problem: Problem): Promise<RunResult> => {
    const code = fs.readFileSync(problem.srcPath, "utf-8");
    const inputLines = input.trim().split("\n");

    if (problem.language === 'cpp') {
        for (let i = 0; i < inputLines.length; i++) {
            if (inputLines[i]=== '[') {
                i++;
                if (inputLines.slice(i).findIndex((line) => line === ']') === -1){
                    throw new Error("Invalid input format");
                }
                while (i < inputLines.length && inputLines[i] !== ']') {
                    inputLines[i] = `${inputLines[i].split(' ').length} ` + inputLines[i];
                    i++;
                }
            }
        }
    }

    const ext = problem.srcPath.split('.').pop() || '';
    const tempSrcPath = path.join(path.dirname(problem.srcPath), `tempCodeFile_${Date.now()}.${ext}`);

    const newCode = fillCode(code, inputLines, problem);
    try {
        fs.writeFileSync(tempSrcPath, newCode);

        input = inputLines.filter((line) => line !== '[' && line !== ']').join("\n");
        let command: string;
        let executablePath: string | null = null;

        if (problem.language === "py" || problem.language === "py3") {
            const pythonCommand = getPreferenceFor('language.python.Command');
            const pythonArgs = getPreferenceFor('language.python.Args');
            command = `${pythonCommand} ${pythonArgs} ${tempSrcPath}`;
        
            return new Promise((resolve) => {
                let stdout = "";
                let stderr = "";
                let timeoutOccurred = false;
        
                const runProcess = spawn(command, { shell: true });
        
                const timeout = setTimeout(() => {
                    timeoutOccurred = true;
                    runProcess.kill("SIGKILL");
                }, 5000);
        
                runProcess.stdout.on("data", (data) => (stdout += data));
                runProcess.stderr.on("data", (data) => (stderr += data));
        
                runProcess.on("close", (code, signal) => {
                    deleteTempCodeFile(tempSrcPath);
                    clearTimeout(timeout);
                    resolve({
                        stdout: stdout.trim(),
                        stderr: stderr.trim(),
                        code,
                        signal,
                        timeout: timeoutOccurred,
                    });
                });
        
                runProcess.on("error", (err) => {
                    deleteTempCodeFile(tempSrcPath);
                    clearTimeout(timeout);
                    resolve({
                        stdout: "",
                        stderr: err.message,
                        code: 1,
                        signal: null,
                        timeout: false,
                    });
                });
        
                if (runProcess.stdin) {
                    try {
                        runProcess.stdin.write(input);
                        runProcess.stdin.end();
                    } catch (e) {
                        console.error("Error occurred while writing to stdin:", e);
                    }
                }
            });
        }
        else if (problem.language === "cpp") {
            const executableName = `a_${Date.now()}.out`;
            executablePath = path.join(path.dirname(tempSrcPath), executableName);
            const cppCommand = getPreferenceFor('language.cpp.Command');
            const cppArgs = getPreferenceFor('language.cpp.Args');
            command = `${cppCommand} ${cppArgs} ${tempSrcPath} -o ${executablePath}`;

            return new Promise((resolve) => {
                let stdout = "";
                let stderr = "";
                let timeoutOccurred = false;
                let childProcessPid: number | undefined = undefined;
        
                const compileProcess = spawn(command, { shell: true });
        
                compileProcess.on("close", (code) => {
                    if (code !== 0) {
                        deleteTempCodeFile(tempSrcPath);
                        resolve({
                            stdout: "",
                            stderr: `Compilation failed with code ${code}`,
                            code,
                            signal: null,
                            timeout: false,
                        });
                        return;
                    }
        
                    console.log("Compilation successful.");
        
                    const runProcess = spawn(executablePath as string, { shell: true });
                    childProcessPid = runProcess.pid;
        
                    runProcess.stdout.on("data", (data) => (stdout += data));
                    runProcess.stderr.on("data", (data) => (stderr += data));
        
                    const timeout = setTimeout(() => {
                        timeoutOccurred = true;
                        if (childProcessPid) {
                            kill(childProcessPid, "SIGKILL");
                        }
                    }, 15000);
        
                    runProcess.on("close", (code, signal) => {
                        clearTimeout(timeout);
        
                        if (executablePath && fs.existsSync(executablePath)) {
                            try {
                                fs.unlinkSync(executablePath);
                            } catch (err) {
                                console.error("Failed to delete executable:", err);
                            }
                        }
                        deleteTempCodeFile(tempSrcPath);
        
                        resolve({
                            stdout: stdout.trim(),
                            stderr: stderr.trim(),
                            code,
                            signal,
                            timeout: timeoutOccurred,
                        });
                    });
        
                    runProcess.on("error", (err) => {
                        deleteTempCodeFile(tempSrcPath);
                        clearTimeout(timeout);
                        resolve({
                            stdout: "",
                            stderr: err.message,
                            code: 1,
                            signal: null,
                            timeout: false,
                        });
                    });
        
                    if (runProcess.stdin) {
                        try {
                            runProcess.stdin.write(input);
                            runProcess.stdin.end();
                        } catch (e) {
                            console.error("Error occurred while writing to stdin:", e);
                        }
                    }
                });
        
                compileProcess.on("error", (err) => {
                    deleteTempCodeFile(tempSrcPath);
                    console.error("Compilation error.");
                    resolve({
                        stdout: "",
                        stderr: err.message,
                        code: 1,
                        signal: null,
                        timeout: false,
                    });
                });
            });
        } else {
            throw new Error("Unsupported file extension");
        }
    } catch (err) {
        console.error("Error during code execution:", err);
        throw err;
    }
};

function deleteTempCodeFile(tempSrcPath: string) {
    if (fs.existsSync(tempSrcPath)) {
        try {
            fs.unlinkSync(tempSrcPath);
        } catch (err) {
            console.error("Failed to delete temporary source file:", err);
        }
    }
}

function verifyOutput(recOutput: string, expOutput: string, returnType: string): boolean {
    const recLines = recOutput.trim().split('\n');
    const expLines = expOutput.trim().split('\n');

    if (recLines.length !== expLines.length) {
        return false;
    }

    if ((returnType === 'float' || returnType === 'double') && expLines.length === 1) {
        const recNum = parseFloat(recLines[0].trim());
        const expNum = parseFloat(expLines[0].trim());
        return recNum === expNum;
    }

    for (let i = 0; i < expLines.length; i++) {
        if (recLines[i].trim() !== expLines[i].trim()) {
            return false;
        }
    }

    return true;
}

export const runSingleTestcase = async (problem: Problem, id: string) => {
    console.log("Running testcase", id);

    const index = problem.tests.findIndex((tc) => tc.id === id);
    if (index === -1) {
        vscode.window.showErrorMessage("Testcase not found.");
    }

    const testcase = problem.tests[index];
    const input = testcase.input;
    const expOutput = testcase.output;

    const runResult = await getSingleRunResult(input, problem);

    const recOutput = runResult.stdout;
    const stderr = runResult.stderr;
    let passed: boolean;

    const errorOccurred =
        stderr !== '' || (runResult.code !== null && runResult.code !== 0) || runResult.signal !== null || runResult.timeout;

    if (errorOccurred) {
        passed = false;
    } else {
        passed = verifyOutput(recOutput, expOutput, problem.returnType);
    }

    if (stderr !== '') {
        outputChannel.clear();
        outputChannel.appendLine(`Error: ${stderr}`);
        outputChannel.show();
    }

    const testResult: TestResult = {
        ...runResult,
        passed,
        id,
    };

    getViewProvider().postMessageToWebview({
        command: 'update-test-case-results',
        problem,
        testResult,
    });
};