// popup.js
document.addEventListener('DOMContentLoaded', () => {
  const spectrumDiv = document.getElementById('color-spectrum');
  const titleDiv = document.createElement('div'); // Add a div for the title
  titleDiv.textContent = `Green = 100% Credible, Red = 0% Credible`; // Add title text
  titleDiv.style.textAlign = 'center'; // Center the title
  titleDiv.style.marginBottom = '5px'; // Add some spacing
  spectrumDiv.parentNode.insertBefore(titleDiv, spectrumDiv); // Add title *before* spectrum

  // Create a gradient representation
  for (let i = 0; i <= 100; i++) {
      const colorDiv = document.createElement('div');
      const credibility = i / 100;

      // Corrected Hue Calculation: Invert the relationship
      const hue = (1 - credibility) * 120; // 0 (green) to 120 (red)

      const saturation = 100;
      const lightness = 75;
      colorDiv.style.backgroundColor = `hsl(${hue}, ${saturation}%, ${lightness}%)`;
      colorDiv.style.width = '2px';
      colorDiv.style.height = '20px';
      colorDiv.style.display = 'inline-block';
      spectrumDiv.appendChild(colorDiv);
  }
});