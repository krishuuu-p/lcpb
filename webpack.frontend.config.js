const path = require('path');
const CopyWebpackPlugin = require('copy-webpack-plugin');

module.exports = {
  mode: 'development', // Use 'development' or 'production' as needed
  entry: './src/webview/frontend/App.tsx', // Entry point for your React app
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: 'webview.js', // Output bundle for the webview
  },
  resolve: {
    extensions: ['.tsx', '.ts', '.js'], // Support TypeScript, JSX, and JavaScript
  },
  module: {
    rules: [
      {
        test: /\.(ts|tsx)$/,
        exclude: /node_modules/,
        use: 'ts-loader', // Compile TypeScript and JSX files
      },
    ],
  },
  plugins: [
    new CopyWebpackPlugin({
      patterns: [
        {
          from: 'src/webview/frontend/app.css',
          to: 'app.css',
        },
        { from: 'src/webview/frontend/index.html', to: 'index.html' },
        {
            from: 'node_modules/@vscode/codicons/dist/codicon.css',
            to: 'codicon.css',
        },
        {
            from: 'node_modules/@vscode/codicons/dist/codicon.ttf',
            to: 'codicon.ttf',
        },
      ],
    }),
  ],
  devtool: 'inline-source-map', // Source maps for easier debugging
};
