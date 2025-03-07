// popup.js
document.addEventListener('DOMContentLoaded', () => {
  const spectrumDiv = document.getElementById('color-spectrum');

  // Create a gradient representation (you could also use an image)
  for (let i = 0; i <= 100; i++) {
    const colorDiv = document.createElement('div');
    const veracity = i / 100;
    const red = Math.round(veracity * 255);
    const green = Math.round((1 - veracity) * 255);
    colorDiv.style.backgroundColor = `rgb(${red}, ${green}, 0)`;
    colorDiv.style.width = '2px';
    colorDiv.style.height = '20px';
    colorDiv.style.display = 'inline-block';
    spectrumDiv.appendChild(colorDiv);
  }
    spectrumDiv.title = `Green = 100% Real, Red = 100% Fake`;
});