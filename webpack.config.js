const webpack = require("webpack");
const path = require("path");
const CopyWebpackPlugin = require("copy-webpack-plugin");
const ExtractTextPlugin = require("extract-text-webpack-plugin");

const pkg = require("./package");
const widgetName = pkg.widgetName;
const name = pkg.widgetName.toLowerCase();

const widgetConfig = {
    entry: `./src/${widgetName}.ts`,
    output: {
        path: path.resolve(__dirname, "dist/tmp"),
        filename: `src/${name}/widget/${widgetName}.js`,
        libraryTarget: "umd"
    },
    resolve: {
        extensions: [ ".ts", ".js", ".json" ],
        alias: {
            "tests": path.resolve(__dirname, "./tests")
        }
    },
    module: {
        rules: [
            { test: /\.ts$/, use: "ts-loader" },
            { test: /\.css$/, loader: ExtractTextPlugin.extract({
                fallback: "style-loader",
                use: "css-loader"
            }) },
            { test: /\.scss$/, loader: ExtractTextPlugin.extract({
                fallback: "style-loader",
                use: "css-loader!sass-loader"
            }) }
        ]
    },
    devtool: "source-map",
    externals:  [ /^mxui\/|^mendix\/|^dojo\/|^dijit\// ],
    plugins: [
        new CopyWebpackPlugin([
            { from: "src/**/*.js" },
            { from: "src/**/*.xml" },
            { from: "src/**/*.png", to: `src/${name}/` }
        ], {
            copyUnmodified: true
        }),
        new ExtractTextPlugin({ filename: `./src/${name}/widget/ui/${widgetName}.css` }),
        new webpack.LoaderOptionsPlugin({
            debug: true
        })
    ]
};

module.exports = [ widgetConfig ];
