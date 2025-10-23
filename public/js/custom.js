/*carousel*/ 
document.addEventListener('DOMContentLoaded', () => {
    GLightbox({
      selector: '.glightbox',
      touchNavigation: true,
      loop: true,
      zoomable: true,
      draggable: true,
    });
  });