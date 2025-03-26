const { STLLoader } = require('three/examples/jsm/loaders/STLLoader.js');
const fs = require('fs');

function calculateVolume(filePath) {
  return new Promise((resolve, reject) => {
    try {
      // Read the file as a binary buffer
      const stlContent = fs.readFileSync(filePath);

      // Check if the file is empty or too small
      if (!stlContent || stlContent.length < 84) {
        throw new Error('Invalid STL file: File is too small or empty');
      }

      // Check if the file is a binary STL file
      const isBinary = !stlContent.slice(0, 5).toString().includes('solid');
      if (!isBinary) {
        throw new Error('Invalid STL file: Only binary STL files are supported');
      }

      // Parse the STL file using STLLoader
      const loader = new STLLoader();
      const geometry = loader.parse(stlContent.buffer);

      // Check if the geometry was parsed successfully
      if (!geometry || !geometry.attributes || !geometry.attributes.position) {
        throw new Error('Invalid STL file: Unable to parse geometry');
      }

      // Calculate the volume
      const positions = geometry.attributes.position.array;
      let volume = 0;

      for (let i = 0; i < positions.length; i += 9) {
        const p1 = [positions[i], positions[i + 1], positions[i + 2]];
        const p2 = [positions[i + 3], positions[i + 4], positions[i + 5]];
        const p3 = [positions[i + 6], positions[i + 7], positions[i + 8]];

        const v321 = p3[0] * p2[1] * p1[2];
        const v231 = p2[0] * p3[1] * p1[2];
        const v312 = p3[0] * p1[1] * p2[2];
        const v132 = p1[0] * p3[1] * p2[2];
        const v213 = p2[0] * p1[1] * p3[2];
        const v123 = p1[0] * p2[1] * p3[2];

        volume += (-v321 + v231 + v312 - v132 - v213 + v123) / 6;
      }

      resolve(Math.abs(volume));
    } catch (error) {
      console.error('Error parsing STL file:', error.message);
      reject(new Error('Invalid STL file. Please upload a valid STL file.'));
    }
  });
}