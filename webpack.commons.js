module.exports = {
	externals: {
       	jquery: '$',
        playcanvas: 'pc',
        cleanPSLG: 'clean-pslg'
	},
	entry: {
		main: './src/main.ts'
	},
	rules: [
		{
			test: /\.(j|t)s(x)?$/,
			exclude: /node_modules/,
			use: {
				loader: 'babel-loader',
				options: {
				cacheDirectory: true,
				babelrc: false,
				presets: [
					[
					'@babel/preset-env',
					{ targets: { browsers: 'last 2 versions' } }, // or whatever your project requires
					],
					'@babel/preset-typescript',
					//'@babel/preset-react',
				],
				plugins: [
					// plugin-proposal-decorators is only needed if you're using experimental decorators in TypeScript
					['@babel/plugin-proposal-decorators', { legacy: true }],
					['@babel/plugin-proposal-class-properties', { loose: true }],
					//'react-hot-loader/babel',
				],
				},
			},
		},
		// all files with a `.ts` or `.tsx` extension will be handled by `ts-loader`
		{ test: /\.tsx?$/, loader: 'ts-loader', options: {compilerOptions:{noEmit: false}} },
		{
			test: /\.(glsl|vs|fs|vert|frag)$/,
			exclude: /node_modules/,
			use: [
			  'raw-loader',
			  //'glslify-loader'
			]
		  }
	]
};