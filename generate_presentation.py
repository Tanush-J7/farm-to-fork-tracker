from pptx import Presentation
from pptx.util import Inches, Pt
from pptx.enum.text import PP_ALIGN
from pptx.dml.color import RGBColor
import os

prs = Presentation()

# Image paths
logo_img = r"C:\Users\HP\.gemini\antigravity\brain\eaf363ce-6e68-411d-8c3a-e76757c91685\.user_uploaded\media_1791381954132.png"
supply_chain_img = r"C:\Users\HP\.gemini\antigravity\brain\eaf363ce-6e68-411d-8c3a-e76757c91685\blockchain_supply_chain_1791382397790.jpg"
ai_dashboard_img = r"C:\Users\HP\.gemini\antigravity\brain\eaf363ce-6e68-411d-8c3a-e76757c91685\ai_price_dashboard_1791382429623.jpg"
qr_consumer_img = r"C:\Users\HP\.gemini\antigravity\brain\eaf363ce-6e68-411d-8c3a-e76757c91685\qr_consumer_tracking_1791382455387.jpg"

def set_font(font, name="Arial", size=Pt(18), bold=False, color=None):
    font.name = name
    font.size = size
    font.bold = bold
    if color:
        font.color.rgb = color

# Slide 1: Conference Title Slide
slide_layout = prs.slide_layouts[0]
slide = prs.slides.add_slide(slide_layout)
# Try adding logos if they exist
if os.path.exists(logo_img):
    # Place logos at the top center
    slide.shapes.add_picture(logo_img, Inches(1), Inches(0.5), width=Inches(8))

title = slide.shapes.title
subtitle = slide.placeholders[1]
title.text = "INTERNATIONAL CONFERENCE ON INTERNET OF THINGS (IOT), CYBER SECURITY, AND BLOCKCHAIN TECHNOLOGY\n(ICITCBT - 2026)"
title.top = Inches(3.5)
subtitle.text = "Conference Date October 08 & 09, 2026"
subtitle.top = Inches(6.0)

# Slide 2: Paper Presentation Details
slide_layout = prs.slide_layouts[1]
slide = prs.slides.add_slide(slide_layout)
title = slide.shapes.title
title.text = "Paper Presentation Details"
content = slide.placeholders[1]
tf = content.text_frame
p1 = tf.paragraphs[0]
p1.text = "Paper Title: Blockchain Based Farm-to-Fork Food Traceability System With AI/ML Integrations"
p2 = tf.add_paragraph()
p2.text = "Paper ID: [Insert Paper ID]"
p3 = tf.add_paragraph()
p3.text = "Author(s): Bhagyashree Ambore, Tanush Patil J, Vellanki Sricharan, B S Krishna, Supreet Kumar"
for p in tf.paragraphs:
    p.alignment = PP_ALIGN.CENTER
    set_font(p.font, size=Pt(24))

# Slide 3: Table of Contents
slide_layout = prs.slide_layouts[1]
slide = prs.slides.add_slide(slide_layout)
title = slide.shapes.title
title.text = "Table of Contents"
content = slide.placeholders[1]
tf = content.text_frame
items = ["1. Abstract", "2. Introduction", "3. Related Work / Survey", "4. Proposed System / Methodology", 
         "5. Experimental Setup / Results", "6. Analysis / Discussion", "7. Conclusion", "8. References"]
tf.text = items[0]
for item in items[1:]:
    tf.add_paragraph().text = item

# Slide 4: 1. Abstract
slide_layout = prs.slide_layouts[1]
slide = prs.slides.add_slide(slide_layout)
title = slide.shapes.title
title.text = "1. Abstract"
content = slide.placeholders[1]
content.width = Inches(8.5) # Expand width
tf = content.text_frame
tf.text = "Tracks agricultural produce to origin, solving lack of market transparency."
tf.add_paragraph().text = "FarmChain AI empowers farmers at harvest using Python-powered AI predictive tools and Ethereum smart contracts."
tf.add_paragraph().text = "Six stakeholder roles with permanent, untamperable records on Ethereum Sepolia Testnet."
tf.add_paragraph().text = "AI market price prediction using XGBoost Regressor (MAPE: 2.72%, R²: 0.984)."
tf.add_paragraph().text = "Consumer verification via QR code scanning with a six-milestone authenticity checklist."

# Slide 5: 2. Introduction
slide_layout = prs.slide_layouts[1]
slide = prs.slides.add_slide(slide_layout)
title = slide.shapes.title
title.text = "2. Introduction"
content = slide.placeholders[1]
content.width = Inches(5.5)
tf = content.text_frame
tf.text = "Agriculture is vital but supply chains are disorganized and lack transparency."
tf.add_paragraph().text = "Structural asymmetry of information limits farmers' negotiation power."
tf.add_paragraph().text = "Centralized tracking systems are vulnerable to manipulation; enterprise blockchains are too expensive."
tf.add_paragraph().text = "FarmChain AI returns data sovereignty to farmers without subscription fees."
if os.path.exists(qr_consumer_img):
    slide.shapes.add_picture(qr_consumer_img, Inches(6.0), Inches(2.0), width=Inches(3.5))

# Slide 6: 3. Related Work / Survey
slide_layout = prs.slide_layouts[1]
slide = prs.slides.add_slide(slide_layout)
title = slide.shapes.title
title.text = "3. Related Work / Survey"
content = slide.placeholders[1]
tf = content.text_frame
tf.text = "Blockchain: Prior enterprise systems (e.g., IBM Food Trust, BIFTS) lacked affordability and usability for rural farmers."
tf.add_paragraph().text = "AI Microservices: XGBoost has become the dominant algorithm for agricultural forecasting."
tf.add_paragraph().text = "Research Gap: A full-range platform integrating AI market predictions with multi-stakeholder custody tracking and consumer verification designed specifically for small farmers is missing."

# Slide 7: 4. Proposed System / Methodology
slide_layout = prs.slide_layouts[1]
slide = prs.slides.add_slide(slide_layout)
title = slide.shapes.title
title.text = "4. Proposed System / Methodology"
content = slide.placeholders[1]
content.width = Inches(5.0)
tf = content.text_frame
tf.text = "Four Layers: React 18 Frontend, Node.js/Express API, FastAPI AI Microservice, Solidity Blockchain Persistence."
tf.add_paragraph().text = "Workflow: Farmer Registration → Admin Approval → Processor Intake → Distributor Custody → Retailer Receipt → Consumer Verification."
p = tf.add_paragraph()
p.text = "Validation Mechanisms: Admin gate, Physical Inspection, AI Anomaly Detection."
if os.path.exists(supply_chain_img):
    slide.shapes.add_picture(supply_chain_img, Inches(5.2), Inches(2.0), width=Inches(4.5))

# Slide 8: 5. Experimental Setup / Results
slide_layout = prs.slide_layouts[1]
slide = prs.slides.add_slide(slide_layout)
title = slide.shapes.title
title.text = "5. Experimental Setup / Results"
content = slide.placeholders[1]
content.width = Inches(5.0)
tf = content.text_frame
tf.text = "AI Pipeline: 2,940 historical records, 30 time-series features. XGBoost achieved 1.26 MAE, 1.86 RMSE, 2.72% MAPE."
tf.add_paragraph().text = "Smart Contracts: Deployed on Sepolia testnet."
tf.add_paragraph().text = "Cost: ~185,432 gas (~0.00037 ETH) for product registration. Total journey ~0.00120 ETH."
tf.add_paragraph().text = "System Latency: Node.js API < 14ms; Python AI ~35ms. Total time < 1.5s."
if os.path.exists(ai_dashboard_img):
    slide.shapes.add_picture(ai_dashboard_img, Inches(5.2), Inches(2.0), width=Inches(4.5))

# Slide 9: 6. Analysis / Discussion
slide_layout = prs.slide_layouts[1]
slide = prs.slides.add_slide(slide_layout)
title = slide.shapes.title
title.text = "6. Analysis / Discussion"
content = slide.placeholders[1]
tf = content.text_frame
tf.text = "Provides complete traceability with verifiable custody transfers."
tf.add_paragraph().text = "Actionable AI market intelligence directly benefits farmers."
tf.add_paragraph().text = "Three-gate off-chain validation successfully addresses blockchain's input truthfulness limitations."
tf.add_paragraph().text = "Decoupled microservice architecture maintains high responsiveness."

# Slide 10: 7. Conclusion
slide_layout = prs.slide_layouts[1]
slide = prs.slides.add_slide(slide_layout)
title = slide.shapes.title
title.text = "7. Conclusion"
content = slide.placeholders[1]
tf = content.text_frame
tf.text = "FarmChain AI effectively integrates blockchain transparency with AI intelligence."
tf.add_paragraph().text = "Provides a secure, low-cost, and responsive agricultural logging system."
tf.add_paragraph().text = "Empowers small-scale farmers against middlemen without enterprise costs."
tf.add_paragraph().text = "Future work: Expand datasets and migrate to Layer-2 scaling networks (e.g., Polygon)."

# Slide 11: 8. References
slide_layout = prs.slide_layouts[1]
slide = prs.slides.add_slide(slide_layout)
title = slide.shapes.title
title.text = "8. References"
content = slide.placeholders[1]
tf = content.text_frame
tf.text = "[1] Ministry of Agriculture & Farmers Welfare, 'Agricultural Statistics at a Glance 2023'."
tf.add_paragraph().text = "[2] F. Tian, 'An agri-food supply chain traceability system for China based on RFID & blockchain technology'."
tf.add_paragraph().text = "[3] Q. Lin et al., 'Food Safety Traceability System Based on Blockchain and EPCIS'."
tf.add_paragraph().text = "[4] T. Chen and C. Guestrin, 'XGBoost: A Scalable Tree Boosting System'."

# Slide 12: Thank You
slide_layout = prs.slide_layouts[0]
slide = prs.slides.add_slide(slide_layout)
title = slide.shapes.title
title.text = "Thank You"
# Make it blue and centered to match the image loosely
title.text_frame.paragraphs[0].alignment = PP_ALIGN.CENTER
try:
    title.text_frame.paragraphs[0].font.color.rgb = RGBColor(0, 112, 192)
except:
    pass
# Remove subtitle
sp = slide.placeholders[1]
sp.element.getparent().remove(sp.element)

prs.save("FarmChain_AI_Presentation_Attractive.pptx")
print("Presentation saved as FarmChain_AI_Presentation_Attractive.pptx")
