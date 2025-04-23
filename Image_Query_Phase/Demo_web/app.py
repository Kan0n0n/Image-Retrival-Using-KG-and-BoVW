from flask import Flask, render_template, send_file, request, jsonify, send_from_directory
from neo4j import GraphDatabase
import cv2
from ultralytics import YOLO
import numpy as np
import os
import json

app = Flask(__name__)

URI = "neo4j://localhost:7687"  
USERNAME = "neo4j"            
PASSWORD = "Tai123321"     
model = YOLO('yolov8x-oiv7.pt') 

#Hist similarity calculate
def sort_classes_by_freq(detected_classes):
    freq_dict = {cls["Class"]: cls["Count"] for cls in classes_freq}
    return sorted(detected_classes, key=lambda cls: freq_dict.get(cls, float('inf')))

def get_vector(cv2_img, bins=32):
    red = cv2.calcHist(
        [cv2_img], [2], None, [bins], [0, 256]
    )
    green = cv2.calcHist(
        [cv2_img], [1], None, [bins], [0, 256]
    )
    blue = cv2.calcHist(
        [cv2_img], [0], None, [bins], [0, 256]
    )
    vector = np.concatenate([red, green, blue], axis=0)
    vector = vector.reshape(-1)
    return vector

def dict_to_vector(hist_list):
    red = np.array(hist_list["R"], dtype=float)
    green = np.array(hist_list["G"], dtype=float)
    blue = np.array(hist_list["B"], dtype=float)
    vector = np.concatenate([red, green, blue], axis=0)
    vector = vector.reshape(-1)
    return vector

def cosine(a,b):
    return np.dot(a, b) / (np.linalg.norm(a) * np.linalg.norm(b))

def caculate_similarity(query_image, dataset_images):
    query_hist_vector = get_vector(query_image)
    similarity = []

    for hist in dataset_images:
        id = hist["ID"]
        histogram = hist["Histogram"]
        similarity.append({
            "ID" : id,
            "Similarity" : cosine(query_hist_vector,histogram)
        })
    
    similarity.sort(key=lambda x: x["Similarity"], reverse=True)

    ids = []
    for sim in similarity:
        ids.append(sim["ID"])
    return ids

def search_hist_from_ids(ids, dataset_hist):
    result = []
    for data in dataset_hist:
        if data["ID"] in ids:
            result.append(data)
        if len(result) == len(ids):
            break
    return result

#load data file
with open (os.path.join(app.static_folder, "Bovw/class_with_none_objs.json")) as f:
    list_of_classes_with_none_objs = json.load(f)
with open(os.path.join(app.static_folder, "Bovw/class_frequencies.json")) as f:
    classes_freq = json.load(f)
with open(os.path.join(app.static_folder, "Bovw/img_hist.json")) as f:
    img_json = json.load(f)
dataset_hist = []
for data in img_json:
    dataset_hist.append({
        "ID": data["ID"],
        "Histogram": dict_to_vector(data["Histogram"])
    })

#flask app
def get_neo4j_driver():
    return GraphDatabase.driver(URI, auth=(USERNAME, PASSWORD))

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/upload', methods=['POST'])
def upload_image():
    try:
        print("Uploading image")

        file = request.files['image-file']
        img_bytes = file.read()
        img_np = cv2.imdecode(np.frombuffer(img_bytes, np.uint8), cv2.IMREAD_COLOR)
        
        print("Image uploaded")

        results = model(img_np)
        print("Model detected objects")
        detected_classes = []
        for track_id, box in enumerate(results[0].boxes):
            class_label = results[0].names[int(box.cls)]
            if class_label not in detected_classes and class_label not in list_of_classes_with_none_objs:
                detected_classes.append(class_label)

        sorted_classes = sort_classes_by_freq(detected_classes=detected_classes)
        original_classes = sorted_classes.copy()
        sorted_classes_str = ", ".join(sorted_classes)

        print("Detected Classes: ") 
        print(sorted_classes)

        eliminated_classes = []
        image_ids = []
        # while sorted_classes:
        with get_neo4j_driver().session() as session:
            query = """
                WITH $classes AS classes
                MATCH (img:Image)
                WHERE ALL(class IN classes WHERE class IN[(img)-[:HAS_A]->(cls:Class) | cls.name])
                RETURN img.image_Id AS image_id
            """
            result = session.run(query, classes=list(sorted_classes))
            for record in result:
                if record["image_id"] not in image_ids:
                    image_ids.append(record["image_id"])
            # if(len(image_ids) < 10 and len(sorted_classes) > 0):
            #     eliminated_class = sorted_classes.pop(0)
            #     eliminated_classes.append(eliminated_class)
            #     print(f"Eliminated class: {eliminated_class}, remaining: {sorted_classes}")
            # else:
            #     break
        
        if len(image_ids) > 1:
            ids_hist = search_hist_from_ids(image_ids,dataset_hist=dataset_hist)
            # print(ids_hist)
            # print(get_vector(img_np))
            sorted_ids = caculate_similarity(img_np,ids_hist)
            print(len(sorted_ids))
            print(len(image_ids))

            response = {
                "image_ids" : sorted_ids,
                "detected_classes" : sorted_classes,
            }

            #save ids result to json file
            #generate a unique filename
            return jsonify(response)
        else:
            return jsonify({"messages" : "No images found. Possible that model can't detected any objects in your image"}), 404
    except: 
        return jsonify({"message" : "There was an error handling this image. Possible that this is a corrupted image or model can't detected any objects in your image" }), 404
    
@app.route('/static/Photos/<filename>')
def send_image(filename):
    return send_from_directory(os.path.join(app.root_path, 'static/Photos'), filename)

if __name__ == '__main__':
    app.run(port=5001)