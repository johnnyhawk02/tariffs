// fractal_worker.js

// --- Core Mandelbrot Logic (modified to accept maxIterations) ---
function mandelbrot(cx, cy, localMaxIterations) { // Renamed maxIterations to localMaxIterations
    let zx = 0;
    let zy = 0;
    let i = 0;
    while (zx * zx + zy * zy < 4 && i < localMaxIterations) {
        let xtemp = zx * zx - zy * zy + cx;
        zy = 2 * zx * zy + cy;
        zx = xtemp;
        i++;
    }
    return i;
}

// Listen for messages from the main thread
self.onmessage = function(e) {
    // Destructure the parameters sent from the main thread
    const { CANVAS_WIDTH, CANVAS_HEIGHT, centerX, centerY, zoom, maxIterations } = e.data;

    // Create an ImageData object to hold the pixel data
    // In modern browsers, `new ImageData(width, height)` is available directly in workers.
    const imageData = new ImageData(CANVAS_WIDTH, CANVAS_HEIGHT);
    const data = imageData.data; // Get the underlying Uint8ClampedArray

    // Calculate the range of the complex plane to display
    const realMin = centerX - zoom / 2;
    const imagMin = centerY - (zoom * (CANVAS_HEIGHT / CANVAS_WIDTH)) / 2;
    
    const realFactor = zoom / CANVAS_WIDTH;
    const imagFactor = (zoom * (CANVAS_HEIGHT / CANVAS_WIDTH)) / CANVAS_HEIGHT;

    // --- The computationally intensive loop ---
    for (let x = 0; x < CANVAS_WIDTH; x++) {
        for (let y = 0; y < CANVAS_HEIGHT; y++) {
            const cx = realMin + x * realFactor;
            const cy = imagMin + y * imagFactor;

            // Call our modified mandelbrot function
            const iterations = mandelbrot(cx, cy, maxIterations);

            const pixelIndex = (y * CANVAS_WIDTH + x) * 4; // Each pixel has 4 components (R,G,B,A)
            
            if (iterations === maxIterations) { // Point is likely in the set
                data[pixelIndex] = 0;     // R
                data[pixelIndex + 1] = 0; // G
                data[pixelIndex + 2] = 0; // B
            } else { // Point escaped, color it based on iteration count
                // Simple HSL-based coloring (same as original)
                const hue = (iterations / maxIterations * 360) % 360;
                const saturation = 1;
                const lightness = 0.5;
                
                const c_hsl = (1 - Math.abs(2 * lightness - 1)) * saturation;
                const x_hsl = c_hsl * (1 - Math.abs((hue / 60) % 2 - 1));
                const m_hsl = lightness - c_hsl / 2;
                let r_ = 0, g_ = 0, b_ = 0;

                if (hue >= 0 && hue < 60) { r_ = c_hsl; g_ = x_hsl; b_ = 0; }
                else if (hue >= 60 && hue < 120) { r_ = x_hsl; g_ = c_hsl; b_ = 0; }
                else if (hue >= 120 && hue < 180) { r_ = 0; g_ = c_hsl; b_ = x_hsl; }
                else if (hue >= 180 && hue < 240) { r_ = 0; g_ = x_hsl; b_ = c_hsl; }
                else if (hue >= 240 && hue < 300) { r_ = x_hsl; g_ = 0; b_ = c_hsl; }
                else { r_ = c_hsl; g_ = 0; b_ = x_hsl; }

                data[pixelIndex] = (r_ + m_hsl) * 255;
                data[pixelIndex + 1] = (g_ + m_hsl) * 255;
                data[pixelIndex + 2] = (b_ + m_hsl) * 255;
            }
            data[pixelIndex + 3] = 255; // Alpha (fully opaque)
        }
    }
    // --- End of computationally intensive loop ---

    // Send the computed ImageData back to the main thread.
    // The second argument `[imageData.data.buffer]` is a list of "transferable objects".
    // This transfers ownership of the underlying ArrayBuffer to the main thread,
    // making it much faster as it avoids copying large amounts of data.
    self.postMessage({ imageData: imageData }, [imageData.data.buffer]);
};