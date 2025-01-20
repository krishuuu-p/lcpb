const path = require('path');

module.exports = {
  target: 'node', // VS Code extensions run in a Node.js environment
  mode: 'none', // Keep source code close to the original
  entry: './src/extension.ts', // Entry point for your VS Code extension
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: 'extension.js', // Output bundle for the extension
    libraryTarget: 'commonjs2',
  },
  externals: {
    vscode: 'commonjs vscode', // Exclude the VS Code module
  },
  resolve: {
    extensions: ['.ts', '.js'], // Support TypeScript and JavaScript
  },
  module: {
    rules: [
      {
        test: /\.ts$/,
        exclude: /node_modules/,
        use: 'ts-loader', // Compile TypeScript files
      },
    ],
  },
  devtool: 'nosources-source-map', // Source maps for debugging
};
