const path = require('path');
const CopyWebpackPlugin = require('copy-webpack-plugin');

module.exports = {
  mode: 'development',
  entry: './src/webview/frontend/App.tsx',
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: 'webview.js',
  },
  resolve: {
    extensions: ['.tsx', '.ts', '.js'],
  },
  module: {
    rules: [
      {
        test: /\.(ts|tsx)$/,
        exclude: /node_modules/,
        use: 'ts-loader',
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
  devtool: 'inline-source-map',
};
