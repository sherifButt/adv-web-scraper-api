// Mobile menu toggle
document.addEventListener('DOMContentLoaded', function () {
  const menuToggle = document.getElementById('menuToggle');
  const mainNav = document.getElementById('mainNav');

  if (menuToggle && mainNav) {
    menuToggle.addEventListener('click', function () {
      mainNav.classList.toggle('active');
    });
  }

  // Demo tabs (PicoCSS style - JS for active label styling only)
  const demoTabLabels = document.querySelectorAll('nav[role="tab-control"] label.demo-tab');

  if (demoTabLabels.length > 0) {
    // Set first tab label as active initially if it exists
    demoTabLabels[0].classList.add('active');

    demoTabLabels.forEach(label => {
      label.addEventListener('click', function () {
        // Remove active class from all tab labels
        demoTabLabels.forEach(l => l.classList.remove('active'));
        // Add active class to the clicked tab label
        this.classList.add('active');
        // No need to handle content panes, CSS does that via :checked
      });
    });
  }
  
  // Add copy button to all pre elements
  const preElements = document.querySelectorAll('pre');
  
  preElements.forEach(pre => {
    const copyButton = document.createElement('button');
    copyButton.className = 'copy-btn';
    copyButton.innerHTML = '<i class="ph ph-copy"></i> Copy';
    copyButton.title = 'Copy to clipboard';
    
    copyButton.addEventListener('click', function () {
      const code = pre.querySelector('code').innerText;
      
      navigator.clipboard.writeText(code).then(() => {
        // Visual feedback
        copyButton.innerHTML = '<i class="ph ph-check"></i> Copied!';
        copyButton.classList.add('copied');
        
        // Reset after 2 seconds
        setTimeout(() => {
          copyButton.innerHTML = '<i class="ph ph-copy"></i> Copy';
          copyButton.classList.remove('copied');
        }, 2000);
      }).catch(err => {
        console.error('Failed to copy: ', err);
        copyButton.innerHTML = '<i class="ph ph-x"></i> Failed';
        
        // Reset after 2 seconds
        setTimeout(() => {
          copyButton.innerHTML = '<i class="ph ph-copy"></i> Copy';
        }, 2000);
      });
    });
    
    pre.appendChild(copyButton);
  });
}); 