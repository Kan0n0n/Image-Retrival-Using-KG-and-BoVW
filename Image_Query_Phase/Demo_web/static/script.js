document
  .getElementById("upload-form")
  .addEventListener("submit", async function (event) {
    event.preventDefault();
    const fileInput = document.getElementById("image-file");
    
    // Validate file input
    if (!fileInput.files || fileInput.files.length === 0) {
      const alert = createAlert("Please select an image file first", "warning");
      document.getElementById("image-container").appendChild(alert);
      return;
    }
    
    const formData = new FormData();
    formData.append("image-file", fileInput.files[0]);
    const uploadedFile = fileInput.files[0];

    // Show loading spinner
    const imageContainer = document.getElementById("image-container");
    imageContainer.innerHTML = createLoadingSpinner();

    try {
      const response = await fetch("/upload", {
        method: "POST",
        body: formData,
      });

      // Clear container for results
      imageContainer.innerHTML = "";

      if (response.ok) {
        const data = await response.json();
        
        // Create row for results
        const resultRow = document.createElement("div");
        resultRow.className = "row g-4";
        
        // 1. Original Image - Left column on larger screens
        const originalCol = document.createElement("div");
        originalCol.className = "col-md-5";
        
        const originalCard = document.createElement("div");
        originalCard.className = "card h-100 shadow-sm";
        
        const cardHeader = document.createElement("div");
        cardHeader.className = "card-header bg-light";
        cardHeader.innerHTML = `<h5 class="mb-0"><i class="fas fa-image me-2"></i>Your Uploaded Image</h5>`;
        
        const cardBody = document.createElement("div");
        cardBody.className = "card-body text-center";
        
        const originalImg = document.createElement("img");
        originalImg.className = "img-fluid rounded";
        originalImg.style.maxHeight = "400px";
        originalImg.src = URL.createObjectURL(uploadedFile);
        originalImg.onload = () => URL.revokeObjectURL(originalImg.src);
        
        cardBody.appendChild(originalImg);
        originalCard.appendChild(cardHeader);
        originalCard.appendChild(cardBody);
        originalCol.appendChild(originalCard);
        
        // 2. Detection Results - Right column on larger screens
        const infoCol = document.createElement("div");
        infoCol.className = "col-md-7";
        
        if (data.detected_classes && data.detected_classes.length > 0) {
          const infoCard = document.createElement("div");
          infoCard.className = "card mb-4 shadow-sm";
          
          const infoHeader = document.createElement("div");
          infoHeader.className = "card-header bg-light";
          infoHeader.innerHTML = `<h5 class="mb-0"><i class="fas fa-search-plus me-2"></i>Detection Results</h5>`;
          
          const infoBody = document.createElement("div");
          infoBody.className = "card-body";
          
          // Add stats row
          const statsRow = document.createElement("div");
          statsRow.className = "row text-center mb-4";
          
          // Objects detected
          statsRow.innerHTML = `
            <div class="col-4">
              <h2 class="text-primary">${data.detected_classes.length}</h2>
              <p class="text-muted small">Classes</p>
            </div>
            <div class="col-4">
              <h2 class="text-primary">${data.image_ids ? data.image_ids.length : 0}</h2>
              <p class="text-muted small">Similar Images</p>
            </div>
            <div class="col-4">
              <h2 class="text-primary">
                <i class="fas fa-check-circle"></i>
              </h2>
              <p class="text-muted small">Analysis Complete</p>
            </div>
          `;
          
          infoBody.appendChild(statsRow);
          
          // Detected classes
          const classesSection = document.createElement("div");
          classesSection.innerHTML = `<h6 class="fw-bold mb-2">Detected Classes:</h6>`;
          
          const classesList = document.createElement("div");
          classesList.className = "d-flex flex-wrap gap-2 mb-3";
          
          data.detected_classes.forEach(cls => {
            const badge = document.createElement("span");
            badge.className = "badge bg-light text-dark border";
            badge.innerHTML = `<i class="fas fa-tag me-1" style="color: #8889CC"></i>${cls}`;
            classesList.appendChild(badge);
          });
          
          classesSection.appendChild(classesList);
          infoBody.appendChild(classesSection);
          
          infoCard.appendChild(infoHeader);
          infoCard.appendChild(infoBody);
          infoCol.appendChild(infoCard);
        }
        
        // Add columns to row
        resultRow.appendChild(originalCol);
        resultRow.appendChild(infoCol);
        imageContainer.appendChild(resultRow);
        
        // 3. Similar Images Section
        if (data.image_ids && data.image_ids.length > 0) {
          const similarSection = document.createElement("div");
          similarSection.className = "mt-4";
          
          const similarCard = document.createElement("div");
          similarCard.className = "card shadow-sm";
          
          const similarHeader = document.createElement("div");
          similarHeader.className = "card-header bg-light";
          similarHeader.innerHTML = `
            <h5 class="mb-0">
              <i class="fas fa-images me-2"></i>Similar Images (${data.image_ids.length})
            </h5>
          `;
          
          const similarBody = document.createElement("div");
          similarBody.className = "card-body";
          
          const imagesGrid = document.createElement("div");
          imagesGrid.className = "row row-cols-2 row-cols-md-3 row-cols-lg-4 g-3";
          
          data.image_ids.forEach((id) => {
            const col = document.createElement("div");
            col.className = "col";
            
            const imgContainer = document.createElement("div");
            imgContainer.className = "card h-100";
            
            const img = document.createElement("img");
            img.src = `/static/Photos/${id}.jpg`;
            img.className = "card-img-top";
            img.style.height = "180px";
            img.style.objectFit = "cover";
            img.alt = `Similar image ${id}`;
            
            const imgBody = document.createElement("div");
            imgBody.className = "card-footer py-1 text-center small text-muted";
            imgBody.textContent = `ID: ${id}`;
            
            imgContainer.appendChild(img);
            imgContainer.appendChild(imgBody);
            col.appendChild(imgContainer);
            imagesGrid.appendChild(col);
          });
          
          similarBody.appendChild(imagesGrid);
          similarCard.appendChild(similarHeader);
          similarCard.appendChild(similarBody);
          similarSection.appendChild(similarCard);
          imageContainer.appendChild(similarSection);
        } else {
          imageContainer.appendChild(
            createAlert("No similar images found. Possible that model can't detect any objects in your image", "warning")
          );
        }
      } else {
        const error = await response.json();
        imageContainer.appendChild(
          createAlert(error.message || "Error processing your request", "danger")
        );
      }
    } catch (err) {
      console.error("Error:", err);
      imageContainer.appendChild(
        createAlert("Network error. Please check your connection and try again.", "danger")
      );
    }
  });

// Helper function to create Bootstrap alerts
function createAlert(message, type = "primary") {
  const alert = document.createElement("div");
  alert.className = `alert alert-${type}`;
  alert.role = "alert";
  
  if (type === "danger") {
    alert.innerHTML = `<i class="fas fa-exclamation-circle me-2"></i>${message}`;
  } else if (type === "warning") {
    alert.innerHTML = `<i class="fas fa-exclamation-triangle me-2"></i>${message}`;
  } else if (type === "success") {
    alert.innerHTML = `<i class="fas fa-check-circle me-2"></i>${message}`;
  } else {
    alert.innerHTML = `<i class="fas fa-info-circle me-2"></i>${message}`;
  }
  
  return alert;
}

// Helper function to create loading spinner
function createLoadingSpinner() {
  return `
    <div class="text-center my-5 py-5">
      <div class="spinner-border mb-3" role="status" style="width: 3rem; height: 3rem; color: #8889CC;">
        <span class="visually-hidden">Loading...</span>
      </div>
      <h5 style="color: #8889CC">Processing your image...</h5>
      <p class="text-muted small">This may take a few seconds</p>
    </div>
  `;
}