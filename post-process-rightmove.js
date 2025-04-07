// post-process-rightmove.js
// This script post-processes the results from the rightmove-config.json extraction

/**
 * Post-process the rightmove extraction results
 * @param {Object} data - The raw extraction data
 * @returns {Object} - The processed data
 */
function postProcessRightmoveResults(data) {
  if (!data || !data.propertyResults || !data.propertyResults.properties) {
    console.error('Invalid data structure');
    return data;
  }

  // Process each property
  const properties = data.propertyResults.properties.map(property => {
    // Process price - extract numeric value
    if (property.price) {
      const priceMatch = property.price.match(/£\s*([0-9,]+)\b/);
      if (priceMatch && priceMatch[1]) {
        property.price = parseInt(priceMatch[1].replace(/,/g, ''), 10);
      }
    }

    // Process bedrooms - extract numeric value
    if (property.bedrooms) {
      const bedroomsMatch = property.bedrooms.match(/([0-9]+)/);
      if (bedroomsMatch && bedroomsMatch[1]) {
        property.bedrooms = parseInt(bedroomsMatch[1]);
      }
    }

    // Process bathrooms - extract numeric value
    if (property.bathrooms) {
      const bathroomsMatch = property.bathrooms.match(/([0-9]+)/);
      if (bathroomsMatch && bathroomsMatch[1]) {
        property.bathrooms = parseInt(bathroomsMatch[1]);
      }
    }

    // Process distance - extract distance value
    if (property.distance) {
      const distanceMatch = property.distance.match(/([0-9]+\.[0-9]+ miles)/);
      if (distanceMatch && distanceMatch[1]) {
        property.distance = distanceMatch[1];
      }
    }

    return property;
  });

  // Update the properties in the data
  data.propertyResults.properties = properties;
  
  return data;
}

// Export the function for use in other files
export default postProcessRightmoveResults;

// If this script is run directly, process the input from stdin
if (import.meta.url === `file://${process.argv[1]}`) {
  let inputData = '';
  
  process.stdin.on('data', chunk => {
    inputData += chunk;
  });
  
  process.stdin.on('end', () => {
    try {
      const data = JSON.parse(inputData);
      const processedData = postProcessRightmoveResults(data);
      console.log(JSON.stringify(processedData, null, 2));
    } catch (error) {
      console.error('Error processing data:', error);
      process.exit(1);
    }
  });
}
