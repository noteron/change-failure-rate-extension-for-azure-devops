const path = require("path");
const CopyWebpackPlugin = require("copy-webpack-plugin");


module.exports = {
  devServer: {
    devMiddleware:{
      writeToDisk: true,
    },
    hot: true,
    client: {
      progress: true
    },
    port: 3000,
    server: 'https',
    static: {
      directory: process.cwd(),
    },
  },
  mode: "production",
  target: "web",
  optimization: {
    minimize: true,
  },
  performance: {
    hints: false
  },
  entry: {Hub: "./" + path.relative(process.cwd(), path.join(__dirname, "src",  "Hub.tsx"))},
  output: {
    filename: "[name].js",
    path: path.resolve(__dirname, 'dist')
  },
  devtool: "inline-source-map",
  resolve: {
    extensions: [".ts", ".tsx", ".js"],
    alias: {
      "azure-devops-extension-sdk": path.resolve(
        "node_modules/azure-devops-extension-sdk"
      ),
    },
    modules: [path.resolve("."), "node_modules"],
  },
  stats: {
    warnings: false,
  },
  module: {
    rules: [
      {
        test: /\.tsx?$/,
        loader: "ts-loader",
      },
      {
        test: /\.scss$/,
        use: ["style-loader", "css-loader", "sass-loader"],
      },
      {
        test: /\.css$/,
        use: ["style-loader", "css-loader"],
      },
      {
        test: /\.(png|svg|jpg|gif|html)$/,
        loader: "file-loader",
      },
    ],
  },
  plugins: [
    new CopyWebpackPlugin({
      patterns: [{ from: "**/*.html", to: "./", context: "src" },
      { from: "**/*.png", to: "./static", context: "static" },
      { from: "./azure-devops-extension.json", to: "azure-devops-extension.json" },
      { from: "./overview.md", to: "./" },],
    }),
  ],
};
