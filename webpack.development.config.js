const webpack = require('webpack');
const path = require('path');
const PlayCanvasWebpackPlugin = require('playcanvas-webpack-plugin');
const configuration = require('./config.json');
const webpackCommon = require("./webpack.commons.js");

configuration.browsers = configuration.browsers || "> 1%";

module.exports = {
    mode: 'development',
    externals: webpackCommon.externals,
    entry: webpackCommon.entry,
    output: {
        path: path.resolve(__dirname, 'build'),
        filename: '[name].build.js'
    },
    plugins: [
        new PlayCanvasWebpackPlugin({
            skipUpload: process.env.UPLOAD === "no" || !configuration.bearer || configuration.bearer.length != 32,
            bearer: configuration.bearer,
            project: configuration.projectId,
            files: configuration.files || {
                "main.build.js": {path: "main.build.js", assetId: configuration.assetId}
            }
        })
    ],
    devtool: 'inline-source-map',
    devServer: {
        contentBase: './build',
        hot: true,
        disableHostCheck: true,
        overlay: true,
        inline: true,
        open: false,
        headers: {
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, PATCH, OPTIONS",
            "Access-Control-Allow-Headers": "X-Requested-With, content-type, Authorization"
        }
    },
    resolve: {
        // Add `.ts` and `.tsx` as a resolvable extension.
        extensions: ['.ts', '.tsx', '.js']
    },
    module: {
        rules: webpackCommon.rules
    }
};

