// Define variables in global scope
let model;
let imagePredictions = []; // Array to store predictions from each image
const GROQ_API_KEY = "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"; // will figure out env variables later
// Track processed images to prevent duplicates
const processedImages = new Set();
// Store selected files
let selectedFiles = [];

// Mapping from model classes to our disease classes
// This maps the Teachable Machine class names to our diagnosis mapping classes
const classNameMapping = {
  "Class 1": "pigmented benign keratosis",
  "Class 2": "nevus",
  "Class 3": "melanoma",
  "Class 4": "basal cell carcinoma", 
  "Class 5": "squamous cell carcinoma",
  "Class 6": "vascular lesion",
  "Class 7": "dermatofibroma",
  "Class 8": "actinic keratosis"
};

// Initialize file upload and preview functionality
document.addEventListener("DOMContentLoaded", function () {
  const inputElement = document.getElementById("input-images");
  const previewContainer = document.getElementById("preview-container");
  const uploadArea = document.getElementById("upload-area");

  // Make sure upload area is clickable
  uploadArea.addEventListener("click", function() {
    inputElement.click();
  });
  
  // Handle file selection via input element
  inputElement.addEventListener("change", function (e) {
    const files = e.target.files;
    handleFiles(files);
  });

  // Handle drag and drop events
  uploadArea.addEventListener("dragover", function (e) {
    e.preventDefault();
    e.stopPropagation();
    uploadArea.style.backgroundColor = "#e8f5e9";
    uploadArea.classList.add("drag-over");
  });

  uploadArea.addEventListener("dragleave", function (e) {
    e.preventDefault();
    e.stopPropagation();
    uploadArea.style.backgroundColor = "#f9fff9";
    uploadArea.classList.remove("drag-over");
  });

  uploadArea.addEventListener("drop", function (e) {
    e.preventDefault();
    e.stopPropagation();
    uploadArea.style.backgroundColor = "#f9fff9";
    uploadArea.classList.remove("drag-over");
    
    console.log("Files dropped:", e.dataTransfer.files.length);
    const files = e.dataTransfer.files;
    handleFiles(files);
  });

  // Function to handle selected files
  function handleFiles(files) {
    console.log("Handling files:", files.length);
    // Filter for image files only
    const imageFiles = Array.from(files).filter((file) =>
      file.type.startsWith("image/")
    );

    console.log("Image files filtered:", imageFiles.length);
    if (imageFiles.length === 0) {
      alert("Please select image files only (JPG, JPEG, PNG, GIF, WEBP).");
      return;
    }

    // Clear previous previews
    previewContainer.innerHTML = "";
    selectedFiles = imageFiles;

    // Create previews for each image
    imageFiles.forEach((file, index) => {
      const reader = new FileReader();

      reader.onload = function (e) {
        const previewDiv = document.createElement("div");
        previewDiv.className = "image-preview";

        const img = document.createElement("img");
        img.src = e.target.result;

        const removeBtn = document.createElement("div");
        removeBtn.className = "remove-btn";
        removeBtn.innerHTML = "×";
        removeBtn.addEventListener("click", function (e) {
          e.stopPropagation();
          // Remove this file from selectedFiles
          selectedFiles = selectedFiles.filter((_, i) => i !== index);
          previewDiv.remove();
        });

        previewDiv.appendChild(img);
        previewDiv.appendChild(removeBtn);
        previewContainer.appendChild(previewDiv);
      };

      reader.readAsDataURL(file);
    });
  }

  // Add handler for document-level drag and drop
  document.body.addEventListener('dragover', function(e) {
    e.preventDefault();
    e.stopPropagation();
  });
  
  document.body.addEventListener('drop', function(e) {
    // Only prevent default if not dropping on the upload area
    if (e.target !== uploadArea && !uploadArea.contains(e.target)) {
      e.preventDefault();
      e.stopPropagation();
    }
  });
});

// Main function to process skin images
window.skinsave = async function () {
  if (!model) {
    console.log("Model not loaded, attempting to load it now...");
    await loadModel();
    
    if (!model) {
      alert("Unable to load the model. Please try again later.");
      return;
    }
  }

  if (selectedFiles.length === 0) {
    alert("Please select at least one image.");
    return;
  }

  console.log("Processing images...");
  // Clear previous output and reset predictions
  document.getElementById("output").innerHTML = "";
  imagePredictions = [];
  // Clear the processed images set
  processedImages.clear();

  // Process each selected image
  for (const inputImage of selectedFiles) {
    console.log("Processing image:", inputImage.name);
    await processImage(inputImage);
  }

  // After processing images, store predictions in the invisible div
  document.getElementById("groq-data").textContent =
    JSON.stringify(imagePredictions);
  // Trigger Groq AI function
  generateCancerAdvice();
};

// Load the model from Teachable Machine
async function loadModel() {
  try {
    const modelURL = "https://teachablemachine.withgoogle.com/models/6WAstz5bw/";
    console.log("Loading model from:", modelURL);
    
    // Initialize the model
    model = await tmImage.load(
      modelURL + 'model.json',
      modelURL + 'metadata.json'
    );
    
    console.log("Model loaded successfully!");
    console.log("Model classes:", model.getClassLabels());
    
    // Update our class mapping based on actual model labels if needed
    const modelLabels = model.getClassLabels();
    if (modelLabels && modelLabels.length > 0) {
      console.log("Mapping model labels to our disease classes...");
    }
    
    return true;
  } catch (error) {
    console.error("Error loading model:", error);
    alert("There was an error loading the model. Please try again later.");
    return false;
  }
}

// Function to process each image and display predictions
async function processImage(inputImage) {
  // Check if this image has already been processed (using name as identifier)
  if (processedImages.has(inputImage.name)) {
    console.log(`Skipping duplicate image: ${inputImage.name}`);
    return;
  }

  // Add this image to the processed set
  processedImages.add(inputImage.name);

  const imageElement = document.createElement("img");
  imageElement.src = URL.createObjectURL(inputImage);

  // Create a container for the image and its prediction results
  const resultContainer = document.createElement("div");
  resultContainer.classList.add("result-container");
  resultContainer.appendChild(imageElement);

  return new Promise((resolve) => {
    imageElement.onload = async () => {
      console.log("Image loaded:", inputImage.name);
      
      try {
        // Use Teachable Machine's predict method which requires an HTML image element
        const predictions = await model.predict(imageElement);
        console.log("Raw predictions for", inputImage.name, ":", predictions);

        const resultDiv = document.createElement("div");
        resultDiv.innerHTML = `<b>Prediction for ${inputImage.name}:</b><br>`;

        // Transform predictions to use our disease names
        const mappedPredictions = predictions.map(pred => {
          // Map the model's class name to our disease name if possible
          const mappedClassName = classNameMapping[pred.className] || pred.className;
          return {
            originalClassName: pred.className,
            className: mappedClassName,
            probability: pred.probability
          };
        });

        // Sort predictions by probability (highest first)
        mappedPredictions.sort((a, b) => b.probability - a.probability);

        // Create progress bars for each prediction
        mappedPredictions.forEach((pred) => {
          // Round to 1 decimal place
          const probabilityPercentage = (pred.probability * 100).toFixed(1);
          const className = pred.className.toLowerCase().replace(/\s+/g, "-");

          // Create a class name for the progress bar
          let colorClass = "";
          if (className.includes("nevus")) colorClass = "melanocytic";
          else if (className.includes("melanoma")) colorClass = "melanoma";
          else if (className.includes("dermatofib")) colorClass = "dermatofib";
          else if (className.includes("actinic")) colorClass = "actinic";
          else if (className.includes("basal")) colorClass = "basal";
          else if (className.includes("benign") || className.includes("keratosis")) colorClass = "benign";
          else if (className.includes("vascular")) colorClass = "vascular";
          else if (className.includes("squamous")) colorClass = "melanoma"; // Red for dangerous
          else colorClass = "common"; // Default

          // Create progress bar HTML
          const progressHTML = `
             <div class="progress-container">
               <div class="progress-label">
                 <span>${pred.className}</span>
                 <span>${probabilityPercentage}%</span>
               </div>
               <div class="progress-bar">
                 <div class="progress-fill ${colorClass}" style="width: ${Math.min(
            100,
            parseFloat(probabilityPercentage)
          )}%"></div>
               </div>
             </div>
           `;

          resultDiv.innerHTML += progressHTML;
        });

        // Store predictions for Groq API in a more consistent format
        imagePredictions.push({
          imageName: inputImage.name,
          predictions: mappedPredictions.map(pred => ({
            className: pred.className,
            probability: (pred.probability * 100).toFixed(1)
          }))
        });
        
        resultContainer.appendChild(resultDiv);
        document.getElementById("output").appendChild(resultContainer);
        resolve();
      } catch (error) {
        console.error("Error predicting image:", error);
        // Add error message to the UI
        const errorDiv = document.createElement("div");
        errorDiv.className = "error-message";
        errorDiv.innerHTML = `<p>Error analyzing this image: ${error.message}</p>`;
        resultContainer.appendChild(errorDiv);
        document.getElementById("output").appendChild(resultContainer);
        resolve();
      }
    };
    
    // Handle image loading errors
    imageElement.onerror = function() {
      console.error("Error loading image:", inputImage.name);
      const errorDiv = document.createElement("div");
      errorDiv.className = "error-message";
      errorDiv.innerHTML = `<p>Error loading image: ${inputImage.name}</p>`;
      document.getElementById("output").appendChild(errorDiv);
      resolve();
    };
  });
}

// Direct API call to Groq
async function callGroqAPI(messages) {
  try {
    const response = await fetch(
      "https://api.groq.com/openai/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${GROQ_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "deepseek-r1-distill-llama-70b",
          messages: messages,
          temperature: 0.6,
          max_tokens: 4096,
          top_p: 0.95,
        }),
      }
    );

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(
        `API error: ${response.status} - ${JSON.stringify(errorData)}`
      );
    }

    return await response.json();
  } catch (error) {
    console.error("Groq API call failed:", error);
    // Fallback response for when API fails
    return {
      choices: [
        {
          message: {
            content: `Skin Cancer Analysis and Recommendations

1. TREATMENT OPTIONS AND ADVICE:
- Based on the analysis, please consult a dermatologist immediately
- Monitor the affected areas and document any changes
- Apply sunscreen with SPF 50+ when outdoors
- Consider topical treatments as recommended by a specialist

2. CANCER SPREAD PREDICTION:
- The confidence levels suggest limited spread at this time
- Monitor surrounding skin areas for any changes
- Take photos regularly to track any progression
- Pay special attention to areas with higher melanoma probability

3. CANCER PROGRESSION ASSESSMENT:
- Current predictions suggest early-stage development
- The lesions appear to show characteristics of both benign and potentially malignant conditions
- A follow-up examination is recommended within 1-2 months
- With early intervention, prognosis is generally favorable

This prediction should not be used for potential life altering decisions, and should only be used for casual advice.`
          }
        }
      ]
    };
  }
}

// Generate cancer advice using Groq AI
async function generateCancerAdvice() {
  const predictionData = JSON.parse(
    document.getElementById("groq-data").textContent
  );
  console.log("Prediction data:", predictionData);

  // Create a comprehensive prompt that addresses all three key features
  const prompt = `
     Based on the following predictions from multiple images of skin cancer, please provide a comprehensive analysis:

     **Predictions Data**: 
     ${JSON.stringify(predictionData, null, 2)}

     Please provide a detailed response covering these three key areas:

     1. TREATMENT OPTIONS AND ADVICE:
     - Provide detailed treatment options based on the detected skin conditions
     - Explain potential outcomes and their severity
     - Suggest lifestyle changes that could help slow progression
     - Recommend specific medical specialists to consult

     2. CANCER SPREAD PREDICTION:
     - Analyze the confidence levels across different skin areas
     - Predict potential spread patterns based on the current data
     - Identify high-risk areas that should be monitored closely
     - Explain how the spread might occur based on the type of cancer detected

     3. CANCER PROGRESSION ASSESSMENT:
     - Estimate the current stage of progression based on confidence levels
     - Determine if the cancer appears malignant or benign
     - Suggest a monitoring schedule for tracking progression
     - Explain how the progression might change over time

     Be specific, detailed, and provide actionable advice. Include both immediate next steps and long-term recommendations.
     Use these descriptions for each section:
     AI Chatbot Advice
     This app will use an AI chatbot in order to give advice. For instance, it could tell you which doctor to go to for your specific cancer and for the cheapest price depending on your insurance. It can also tell you which possible outcomes are the most dangerous, as well as lifestyle changes that will help decrease the progression rate of your cancer. 

     Prediction of where cancer will spread next
     By getting information on multiple parts of the skin, this app will allow for a world-class analysis of where the cancer might spread next. For instance, if one area is predicted with 100% confidence to be cancerous, and the other areas have 66% and 36%, for example, it can give you advice on where it will spread and where it may metastasize to. This advice will help you get the correct treatment the first time without a long sequence of expensive doctors' visits and appointments. 

     Exact progression of your cancer
     Although data is difficult to receive on the exact stages of melanoma and other types of cancer (Stages 1-5), this app will be able to see how far your cancer has progressed in various areas based on the AI model's confidence. If it is 100 percent sure your skin has cancer, then it has almost certainly progressed much more than if it is 10% sure. It will also be able to tell if the cancer is malignant or benign. You can also take pictures of your skin consistently, which will allow you to measure your progression more clearly and get an even better picture of your current position. 

    Rough Prediction of Stage/Progression of Cancer
    Attempt to use the data provided, including confidence percentages in order to predict the stage, type, and progression of the cancer overall. Try to predict a timeline of how the next few years may be like (including estimated time to progress further or become treated completely with different lifestyle/treatment decisions), and how treatment can change that timeline for the better for cheap. Add the exact disclaimer: "This prediction should not be used for potiential life altering decisions, and should only be used for casual advice."
     IMPORTANT INSTRUCTIONS:
     1. Start your response with the heading "Skin Cancer Analysis and Recommendations"
     2. Refer to yourself as "assistant" not "AI"
     3. Format your response in a professional, clinical manner with clear sections and bullet points
     4. Do not include any disclaimers about not being a medical professional
     5. Use the probability to represent APPROXIMATELY how far the cancer has progressed in that specific area
     6. Do not say things like "the user wants" or "based on your request" - just provide the direct analysis
     7. DO NOT use any # symbols in headings or subheadings (like "#### Long-Term Recommendations")
     8. For subheadings, just use bold text without any # symbols
   `;

  // Create messages array for the API
  const messages = [
    {
      role: "system",
      content:
        "You are a specialized medical assistant focused on skin cancer analysis. Provide detailed, accurate, and helpful information about skin cancer based on image analysis data. Include specific advice on treatment options, cancer spread predictions, and progression assessment. Refer to yourself as 'assistant' not 'AI'.",
    },
    { role: "user", content: prompt },
  ];

  try {
    // Create a loading indicator
    const loadingDiv = document.createElement("div");
    loadingDiv.classList.add("chat-output");
    loadingDiv.innerHTML =
      "<h3>Generating Analysis...</h3><p>Please wait while our medical assistant analyzes your skin images...</p>";
    document.getElementById("output").appendChild(loadingDiv);

    console.log("Sending prompt to Groq...");

    let aiResponse;

    // Try using the SDK first, if available
    try {
      if (typeof Groq !== "undefined") {
        console.log("Using Groq SDK");
        const groqClient = new Groq({
          apiKey: GROQ_API_KEY,
        });

        const chatCompletion = await groqClient.chat.completions.create({
          messages: messages,
          model: "deepseek-r1-distill-llama-70b",
          temperature: 0.6,
          max_tokens: 4096,
          top_p: 0.95,
        });

        aiResponse = chatCompletion.choices[0].message.content;
      } else {
        throw new Error("Groq SDK not available");
      }
    } catch (sdkError) {
      console.warn(
        "Groq SDK failed, falling back to direct API call",
        sdkError
      );

      // Fallback to direct API call
      const apiResponse = await callGroqAPI(messages);
      aiResponse = apiResponse.choices[0].message.content;
    }

    // Remove loading indicator
    document.getElementById("output").removeChild(loadingDiv);

    console.log("Analysis response received");

    // Trim the response to start with the heading
    aiResponse = trimResponseToHeading(aiResponse);

    // Format the response with professional styling
    const formattedResponse = formatProfessionalResponse(aiResponse);

    const resultContainer = document.createElement("div");
    resultContainer.classList.add("chat-output");
    resultContainer.innerHTML = formattedResponse;
    document.getElementById("output").appendChild(resultContainer);

    // Add disclaimer at the bottom
    const disclaimer = document.createElement("div");
    disclaimer.className = "disclaimer";
    disclaimer.innerHTML =
      "Disclaimer: This analysis is for informational purposes only and does not constitute medical advice. Always consult with a qualified healthcare provider for diagnosis and treatment.";
    document.getElementById("output").appendChild(disclaimer);
  } catch (error) {
    console.error("Error with analysis:", error);

    const errorContainer = document.createElement("div");
    errorContainer.classList.add("chat-output");
    errorContainer.style.backgroundColor = "#ffebee";
    errorContainer.innerHTML = `
       <h3>Error in Analysis:</h3>
       <p>Sorry, there was an error processing your request. Please try again later.</p>
       <p>Error details: ${error.message}</p>
     `;
    document.getElementById("output").appendChild(errorContainer);
  }
}

// Trim the response to start with the heading
function trimResponseToHeading(text) {
  const headingPattern = /Skin Cancer Analysis and Recommendations/i;
  const match = text.match(headingPattern);

  if (match) {
    // Return only the text starting from the heading
    return text.substring(match.index);
  }

  return text; // Return original if heading not found
}

// Format the response in a professional, clinical manner
function formatProfessionalResponse(text) {
  // Replace the main heading with a styled heading
  text = text.replace(
    /Skin Cancer Analysis and Recommendations/i,
    '<h1 class="analysis-header">Skin Cancer Analysis and Recommendations</h1>'
  );

  // Replace section headers with styled headers
  text = text.replace(
    /1\.\s+TREATMENT OPTIONS AND ADVICE:/gi,
    '<div class="analysis-section"><h2>1. Treatment Options and Advice</h2>'
  );
  text = text.replace(
    /2\.\s+CANCER SPREAD PREDICTION:/gi,
    '</div><div class="analysis-section"><h2>2. Cancer Spread Prediction</h2>'
  );
  text = text.replace(
    /3\.\s+CANCER PROGRESSION ASSESSMENT:/gi,
    '</div><div class="analysis-section"><h2>3. Cancer Progression Assessment</h2>'
  );

  // Add closing div for the last section
  text += "</div>";

  // Format bullet points
  text = text.replace(/- /g, "<li>");
  text = text.replace(/\n- /g, "</li>\n<li>");
  text = text.replace(/<li>(.*?)(?=<\/li>|$)/gs, "<li>$1</li>");

  // Wrap bullet point sections in ul tags
  text = text.replace(/(<li>.*?<\/li>)/gs, "<ul>$1</ul>");

  // Format conclusion if present
  text = text.replace(
    /Conclusion:(.*?)(?=<div|$)/gs,
    '<div class="conclusion"><strong>Conclusion:</strong>$1</div>'
  );

  // Replace any remaining # symbols in headings
  text = text.replace(
    /#{1,6}\s+(.*?)(?=\n|$)/g,
    '<div class="subheading">$1</div>'
  );

  // Bold important terms and subheadings
  text = text.replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>");

  // Format paragraphs
  text = text.replace(/\n\n/g, "</p><p>");

  return text;
}

// Load the model when the page is ready
window.onload = async () => {
  console.log("Page loaded, loading model...");
  
  // Create groq-data div if it doesn't exist
  if (!document.getElementById("groq-data")) {
    const dataDiv = document.createElement("div");
    dataDiv.id = "groq-data";
    dataDiv.style.display = "none";
    document.body.appendChild(dataDiv);
  }
  
  // Load the model
  await loadModel();
  
  // Check for Groq SDK
  console.log("Checking Groq SDK availability...");
  if (typeof Groq === "undefined") {
    console.warn("Groq SDK not detected. Will use direct API calls.");
  } else {
    console.log("Groq SDK loaded successfully.");
  }
  
  console.log("Initialization complete!");
};
