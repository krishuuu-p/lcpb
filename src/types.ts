export type TestCase = {
    input: string;
    output: string;
    paramInputMap: Record<string, string>;
    id: string;
};

export type Problem = {
    name: string;
    description: string;
    url: string;
    memoryLimit: number;
    timeLimit: number;
    tests: TestCase[];
    srcPath: string;
    language: string;
} & ParsedFunction;

export type ParsedFunction = {
    functionName: string;
    returnType: string;
    parameters: { paramType: string; paramName: string }[];
};

export type RunResult = {
    stdout: string;
    stderr: string;
    code: number|null;
    signal: string|null;
    timeout: boolean;
}

export type TestResult = {
    passed: boolean | null;
    id: string;
} & RunResult;

export type TestCaseResult  = {
    id: string;
    result: TestResult | null;
    testcase: TestCase;
};

export type FetchLCProblem = {
    command: 'fetch-lc-problem';
    url: string;
};

export type RunSingleTestcase = {
    command: 'run-single-testcase';
    problem: Problem;
    id: string;
};

export type NewTestCaseFromFileCommand= {
    command: 'new-testcase-from-file';
    inputFile: string|null;
    outputFile: string|null;
    problem: Problem;
};

export type SelectFileCommand = {
    command: 'select-file';
    fileType: string;
}

export type OpenHelpUrlCommand = {
    command: 'open-help-url';
};

export type ErrorFromWebviewCommand = {
    command: 'error-from-webview';
    message: string;
};

export type CopyStdinCommand = {
    command: 'copy-stdin';
    paramInputMap: Record<string, string>;
    problem: Problem;
};

export type CopyDriverCodeCommand = {
    command: 'copy-driver-code';
    paramInputMap: Record<string, string>;
    problem: Problem;
};

export type CopyInputCommand = {
    command: 'copy-input';
    input: string;
};

export type SaveCommand = {
    command: 'save';
    problem: Problem;
};

export type DeleteProblemCommand = {
    command: 'delete-problem';
    srcPath: string;
};

export type WebviewToVSEvent =
    | FetchLCProblem
    | RunSingleTestcase
    | NewTestCaseFromFileCommand
    | SelectFileCommand
    | OpenHelpUrlCommand
    | ErrorFromWebviewCommand
    | CopyStdinCommand
    | CopyDriverCodeCommand
    | CopyInputCommand
    | SaveCommand
    | DeleteProblemCommand;

export type UpdateProblemCommand = {
    command: 'update-problem';
    problem: Problem | undefined;
};

export type ErrorFromExtensionCommand = {
    command: 'error-from-extension';
    message: string;
};

export type UpdateTestCaseResultsCommand = {
    command: 'update-test-case-results';
    problem: Problem;
    testResult: TestResult;
};

export type FileSelectedCommand = {
    command: 'file-selected';
    fileType: string;
    filePath: string;
};

export type UpdateFileTestCaseCommand = {
    command: 'update-file-testcase';
    tcResult: TestCaseResult;
};

export type NewProblemCommand = {
    command: 'new-problem';
    problem: Problem | undefined;
};

export type VSToWebViewMessage =
    | UpdateProblemCommand
    | ErrorFromExtensionCommand
    | UpdateTestCaseResultsCommand
    | FileSelectedCommand
    | UpdateFileTestCaseCommand
    | NewProblemCommand;