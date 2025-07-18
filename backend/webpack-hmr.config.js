const nodeExternals = require('webpack-node-externals');
const { RunScriptWebpackPlugin } = require('run-script-webpack-plugin');

module.exports = function (options, webpack) {
    const lazyImports = [
        '@nestjs/microservices/microservices-module',
        '@nestjs/websockets/socket-module',
    ];

    return {
        ...options,
        externals: [nodeExternals()],
        output: {
            ...options.output,
            libraryTarget: 'commonjs2',
        },
        plugins: [
            ...options.plugins,
            new webpack.IgnorePlugin({
                checkResource(resource) {
                    const lazyImports = [
                        '@nestjs/microservices',
                        '@nestjs/websockets',
                        'cache-manager',
                        'class-validator',
                        'class-transformer',
                    ];
                    if (!lazyImports.includes(resource)) {
                        return false;
                    }
                    try {
                        require.resolve(resource);
                    } catch (err) {
                        return true;
                    }
                    return false;
                },
            }),
            new RunScriptWebpackPlugin({ name: options.output.filename }),
        ],
    };
}; 