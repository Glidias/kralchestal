const webpack = require('webpack');
const path = require('path');
const TerserPlugin = require('terser-webpack-plugin');
const PlayCanvasWebpackPlugin = require('playcanvas-webpack-plugin');
const configuration = require('./config.json');
const webpackCommon = require("./webpack.commons.js");

configuration.browsers = configuration.browsers || "> 1%";

module.exports = {
    mode: 'production',
    externals: webpackCommon.externals,
    entry: webpackCommon.entry,
    optimization: {
        minimize: true,
        minimizer: [new TerserPlugin({sourceMap: true})],
    },
    output: {
        path: path.resolve(__dirname, 'build'),
        filename: '[name].build.js'
    },
    optimization: {
        minimize: true,
        minimizer: [
            new TerserPlugin({
                sourceMap: true,
            }),
        ],
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
    devtool: 'source-map',
    resolve: {
        // Add `.ts` and `.tsx` as a resolvable extension.
        extensions: ['.ts', '.tsx', '.js']
    },
    module: {
        rules: webpackCommon.rules
    }
};

