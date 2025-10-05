/**
 * GIF Resizer Utility
 * 
 * Note: True animated GIF resizing requires server-side processing or external APIs.
 * This utility provides client-side options for optimization.
 */

/**
 * Resize a GIF file to fit within max dimensions
 * WARNING: This converts to static image (first frame only)
 * For true animated GIF resizing, use external services like ezgif.com
 * 
 * @param {string} uri - File URI
 * @param {number} maxWidth - Maximum width (default 320)
 * @param {number} maxHeight - Maximum height (default 240)
 * @returns {Promise<{uri: string, blob: Blob, wasResized: boolean}>}
 */
export async function resizeGifToStatic(uri, maxWidth = 320, maxHeight = 240) {
  try {
    // This will only work with expo-image-manipulator
    const ImageManipulator = require('expo-image-manipulator');
    
    const result = await ImageManipulator.manipulateAsync(
      uri,
      [{ resize: { width: maxWidth, height: maxHeight } }],
      { compress: 0.8, format: ImageManipulator.SaveFormat.JPEG }
    );
    
    const response = await fetch(result.uri);
    const blob = await response.blob();
    
    return {
      uri: result.uri,
      blob: blob,
      wasResized: true,
      note: 'Converted to static JPEG (animation lost)'
    };
  } catch (error) {
    console.error('Resize failed:', error);
    // Return original
    const response = await fetch(uri);
    const blob = await response.blob();
    return {
      uri: uri,
      blob: blob,
      wasResized: false,
      error: error.message
    };
  }
}

/**
 * Calculate optimal dimensions to fit within bounds while maintaining aspect ratio
 * 
 * @param {number} width - Original width
 * @param {number} height - Original height
 * @param {number} maxWidth - Maximum width
 * @param {number} maxHeight - Maximum height
 * @returns {{width: number, height: number, scale: number}}
 */
export function calculateOptimalSize(width, height, maxWidth = 320, maxHeight = 240) {
  const widthRatio = maxWidth / width;
  const heightRatio = maxHeight / height;
  const scale = Math.min(widthRatio, heightRatio, 1); // Don't upscale
  
  return {
    width: Math.floor(width * scale),
    height: Math.floor(height * scale),
    scale: scale
  };
}

/**
 * Get GIF dimensions without loading the entire file
 * 
 * @param {string} uri - File URI
 * @returns {Promise<{width: number, height: number}>}
 */
export async function getGifDimensions(uri) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      resolve({
        width: img.width,
        height: img.height
      });
    };
    img.onerror = reject;
    img.src = uri;
  });
}

/**
 * Check if GIF needs resizing
 * 
 * @param {string} uri - File URI
 * @param {number} maxWidth - Maximum width
 * @param {number} maxHeight - Maximum height
 * @returns {Promise<{needsResize: boolean, currentSize: object, targetSize: object}>}
 */
export async function checkIfGifNeedsResize(uri, maxWidth = 320, maxHeight = 240) {
  try {
    const dimensions = await getGifDimensions(uri);
    const needsResize = dimensions.width > maxWidth || dimensions.height > maxHeight;
    const targetSize = calculateOptimalSize(dimensions.width, dimensions.height, maxWidth, maxHeight);
    
    return {
      needsResize,
      currentSize: dimensions,
      targetSize: targetSize
    };
  } catch (error) {
    return {
      needsResize: false,
      error: error.message
    };
  }
}

/**
 * Get optimization suggestions for a GIF
 * 
 * @param {Blob} blob - GIF blob
 * @param {number} width - Width
 * @param {number} height - Height
 * @returns {object} Optimization suggestions
 */
export function getOptimizationSuggestions(blob, width, height) {
  const sizeKB = Math.round(blob.size / 1024);
  const suggestions = [];
  
  if (sizeKB > 150) {
    suggestions.push(`File is ${sizeKB}KB (limit: 150KB)`);
  }
  
  if (width > 320 || height > 240) {
    const optimal = calculateOptimalSize(width, height);
    suggestions.push(`Resize from ${width}x${height} to ${optimal.width}x${optimal.height}`);
  }
  
  if (sizeKB > 100) {
    suggestions.push('Reduce colors to 128-256');
    suggestions.push('Remove unnecessary frames');
  }
  
  if (suggestions.length === 0) {
    suggestions.push('GIF is already optimized!');
  }
  
  return {
    sizeKB,
    dimensions: { width, height },
    suggestions,
    needsOptimization: suggestions.length > 1,
    recommendedTool: 'ezgif.com'
  };
}

/**
 * Generate ezgif.com optimization URL
 * This opens the browser to ezgif.com with optimization tools
 * 
 * @returns {string} URL to ezgif.com optimizer
 */
export function getEzgifUrl() {
  return 'https://ezgif.com/optimize';
}

/**
 * Format optimization instructions for user
 * 
 * @param {object} suggestions - Optimization suggestions
 * @returns {string} Formatted instructions
 */
export function formatOptimizationInstructions(suggestions) {
  let instructions = `GIF Optimization Needed (${suggestions.sizeKB}KB)\n\n`;
  instructions += 'Recommendations:\n';
  suggestions.suggestions.forEach((s, i) => {
    instructions += `${i + 1}. ${s}\n`;
  });
  instructions += `\nUse ${suggestions.recommendedTool} to optimize your GIF.`;
  
  return instructions;
}

export default {
  resizeGifToStatic,
  calculateOptimalSize,
  getGifDimensions,
  checkIfGifNeedsResize,
  getOptimizationSuggestions,
  getEzgifUrl,
  formatOptimizationInstructions
};
