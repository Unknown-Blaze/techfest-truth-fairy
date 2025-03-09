// popup.js

document.addEventListener('DOMContentLoaded', () => {
  // Main container
  const container = document.createElement('div');
  container.id = 'main-container';

  // Header section
  const header = document.createElement('div');
  header.id = 'header';

  // Main title: "Truth Fairy"
  const mainTitle = document.createElement('h1');
  mainTitle.textContent = "Truth Fairy";
  header.appendChild(mainTitle);

  // Subtitle: "Misinformation & Deepfake Checker"
  const subTitle = document.createElement('h2');
  subTitle.textContent = "Misinformation & Deepfake Checker";
  header.appendChild(subTitle);

  container.appendChild(header);

  // Content area (below the header)
  const content = document.createElement('div');
  content.id = 'content';

  // Columns container
  const columnsContainer = document.createElement('div');
  columnsContainer.id = 'columns';

  // Left column: Text Analysis
  const textColumn = document.createElement('div');
  textColumn.className = 'column';

  const textHeading = document.createElement('h3');
  textHeading.innerHTML = `
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
         stroke="#007BFF" stroke-width="2" stroke-linecap="round"
         stroke-linejoin="round">
      <path d="M9 9h6M9 13h6M9 17h6"/>
      <path d="M5 3h10l4 4v14a2 2 0 0 1-2 2H5
               a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z"/>
    </svg>
    Text Analysis
  `;
  textColumn.appendChild(textHeading);

  const textDescription = document.createElement('p');
  textDescription.textContent =
    "Checks if text is misinformation and verifies if it can be confirmed.";
  textColumn.appendChild(textDescription);

  columnsContainer.appendChild(textColumn);

  // Right column: Image Analysis
  const imageColumn = document.createElement('div');
  imageColumn.className = 'column';

  const imageHeading = document.createElement('h3');
  imageHeading.innerHTML = `
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
         stroke="#007BFF" stroke-width="2" stroke-linecap="round"
         stroke-linejoin="round">
      <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
      <circle cx="8.5" cy="8.5" r="1.5"></circle>
      <path d="M21 15l-5-5L5 21"></path>
    </svg>
    Image Analysis
  `;
  imageColumn.appendChild(imageHeading);

  const imageDescription = document.createElement('p');
  imageDescription.textContent =
    "Evaluates if an image is authentic or a potential deepfake.";
  imageColumn.appendChild(imageDescription);

  columnsContainer.appendChild(imageColumn);

  // Add columns to content
  content.appendChild(columnsContainer);

  // Add content to main container
  container.appendChild(content);

  // Finally, append the container to the body
  document.body.appendChild(container);
});
