# LeetCode Problem Buddy (LCPB) VS Code Extension  

Welcome to the documentation for **LeetCode Problem Buddy (LCPB)**, a VS Code extension designed to simplify the process of testing LeetCode problems on your local machine. This extension allows you to fetch LeetCode problems (using the [leetcode-query](https://www.npmjs.com/package/leetcode-query) API), test them against the provided test cases or custom test cases, and even add test cases from local text files.  

All of this is accomplished without the need to manually write driver code, as the driver code is automatically generated based on the problem being worked on. While this approach significantly streamlines development, the complexity of LeetCode's diverse problem set and tight development timeline present challenges in comprehensively addressing all edge cases. Specifically, problems involving pointer data types (with the exception of consistently handled `TreeNode`) may necessitate manual driver code implementation, particularly due to the varied definitions of custom types like `Node` or `ListNode`.

## Key Assumptions  

To ensure a smooth experience, the following assumptions were made for input formats:  

1. **Single-Dimensional Arrays or Lists**  
   - For parameters of type `vector<>` or `List[]`, the input must be provided in a single line, with no newline characters.  
   - Elements should be separated by spaces and enclosed within square brackets (`[]`).  

2. **Multi-Dimensional Arrays or Nested Lists**  
   - For parameters of type `vector<vector<>>` or `List[List[]]`, follow the same single-line format for each inner vector or list.  
   - The parent vector or list must be enclosed in an additional pair of square brackets (`[]`).  

3. **Binary Trees (`TreeNode`)**  
   - For parameters of type `TreeNode*` (C++), `TreeNode`, or `Optional[TreeNode]` (Python), use the same input format as for `vector<>` or `List[]`.  

## Supported Languages  

- C++  
- Python  

## Features  

1. **Automatic Driver Code Generation**  
   - Eliminates the need to manually write boilerplate code for test cases.  
2. **Run Code Against Test Cases**  
   - Supports both example test cases and user-defined test cases.  
3. **Detailed Test Case Output**  
   - Displays expected and received outputs for each test case.  
4. **Error Handling**  
   - Provides clear error messages when test cases fail.  
5. **File-Based Test Cases**  
   - Allows fetching and running test cases directly from local text files.  
6. **Custom Configuration Options**  
   - Configure paths, settings, and compilation commands for each supported language.  
7. **Save Test Cases**  
   - Test cases can be saved to files based on user preferences in the settings.
8. **Fetch Template Code**  
   - Retrieve template files for supported languages directly from user-specified locations, ensuring a personalized and seamless coding experience.

## Demo  

[Watch the Demo Video Here](https://drive.google.com/file/d/1jAQ9RQoMTc3lnyxUQ0WUgEBgMMg5A4CC/view?usp=sharing)  

## Extension Settings  

The following settings can be configured to customize your experience:  

- **General Settings**  
  - `lcpb.general.saveTestCases`: Enable or disable saving fetched test cases to a file.  
  - `lcpb.general.testcaseSaveLocation`: Specify the directory where test case files will be saved.
  - `lcpb.general.problemSaveLocation`: Specify the directory where problems will be saved in JSON format.  

- **Language-Specific Settings**  
  - C++:  
    - `lcpb.general.templateFileLocationCpp`: Path to the C++ template file for LeetCode problems.  
    - `lcpb.language.cpp.Args`: Additional compilation flags for C++ files.  
    - `lcpb.language.cpp.Command`: Command used to compile C++ files (e.g., `g++`, `clang++`).  
  - Python:  
    - `lcpb.general.templateFileLocationPython`: Path to the Python template file for LeetCode problems.  
    - `lcpb.language.python.Args`: Compilation flags for Python files.  
    - `lcpb.language.python.Command`: Command used to execute Python files (e.g., `python3`, `pypy3`).  

## Release Notes  

### Version 1.0.0  

Initial release of LeetCode Problem Buddy, bringing automated driver code generation, custom test case support, and seamless integration for LeetCode problem solving.  

---
