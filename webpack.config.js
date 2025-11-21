// Import required dependencies
const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const CopyWebpackPlugin = require('copy-webpack-plugin');

// Webpack configuration object
module.exports = {
  // Entry point of the application
  entry: './src/index.tsx',
  
  // Output configuration
  output: {
    filename: 'chat-widget.js',  // Name of the bundled JS file
    path: path.resolve(__dirname, 'dist'),  // Output directory
    library: 'ChatWidget',  // Name of the global variable when used as a library
    libraryTarget: 'umd',   // Universal Module Definition - works in any environment
    globalObject: 'this',   // Ensures compatibility in browser environments
  },
  
  // Module resolution configuration
  resolve: {
    extensions: ['.ts', '.tsx', '.js'],  // File extensions to resolve
  },
  
  // Module rules for different file types
  module: {
    rules: [
      {
        test: /\.tsx?$/,  // Match TypeScript and TSX files
        use: 'ts-loader',  // Use ts-loader for TypeScript files
        exclude: /node_modules/,  // Exclude node_modules directory
      },
      {
        test: /\.css$/,  // Match CSS files
        use: ["style-loader", "css-loader"],  // Process CSS files
      },
      {
        test: /\.(png|jpg|jpeg|gif|svg)$/i,  // Match image files
        type: "asset/resource",  // Handle images as resources
      },
    ],
  },
  
  // Webpack plugins
  plugins: [
    new HtmlWebpackPlugin({
      template: './public/index.html',  // HTML template for development
    }),
    new CopyWebpackPlugin({
      patterns: [
        {
          from: 'public/Asset',
          to: 'Asset'
        },
        {
          from: 'public/Jazz.mp3',
          to: 'Jazz.mp3'
        },
        {
          from: 'public/widget',
          to: 'widget'
        },
        {
          from: 'public/chat-widget-wrapper.html',
          to: 'chat-widget-wrapper.html'
        },
        {
          from: 'public/ai-agent-sdk.js',
          to: 'ai-agent-sdk.js'
        }
      ]
    }),
  ],
  
  // Development tools configuration
  devtool: 'source-map',  // Generate source maps for debugging
  
  // Development server configuration
  devServer: {
    static: [
      {
        directory: path.join(__dirname, 'dist'),  // Serve static files from dist directory
      },
      {
        directory: path.join(__dirname, 'public'),  // Serve static files from public directory
        publicPath: '/',  // Serve public files at root path
      }
    ],
    headers: {
      'Access-Control-Allow-Origin': '*',  // Enable CORS for all origins
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, PATCH, OPTIONS',  // Allowed HTTP methods
      'Access-Control-Allow-Headers': 'X-Requested-With, content-type, Authorization'  // Allowed headers
    },
    port: 4000,  // Development server port
    hot: true,  // Enable Hot Module Replacement
  },
};
