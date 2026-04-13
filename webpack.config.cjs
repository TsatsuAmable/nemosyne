/**
 * Webpack build configuration for Nemosyne
 * Creates bundled distribution files
 */

const path = require('path');

module.exports = {
  entry: {
    'nemosyne': './src/index.js',
    'nemosyne.min': './src/index.js'
  },
  
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: '[name].js',
    library: 'Nemosyne',
    libraryTarget: 'umd',
    globalObject: 'this'
  },
  
  module: {
    rules: [
      {
        test: /\.js$/,
        exclude: /node_modules/,
        use: {
          loader: 'babel-loader',
          options: {
            presets: ['@babel/preset-env']
          }
        }
      }
    ]
  },
  
  externals: {
    'aframe': 'AFRAME',
    'three': 'THREE'
  },
  
  optimization: {
    minimize: true,
    splitChunks: {
      chunks: 'all',
      cacheGroups: {
        vendors: {
          test: /[\\/]node_modules[\\/]/,
          priority: -10
        },
        default: {
          minChunks: 2,
          priority: -20,
          reuseExistingChunk: true
        }
      }
    }
  },
  
  devtool: 'source-map',
  
  devServer: {
    static: {
      directory: path.join(__dirname, 'examples'),
      publicPath: '/',
    },
    port: 8080,
    hot: true,
    open: true
  }
};
