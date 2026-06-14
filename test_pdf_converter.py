#!/usr/bin/env python3
"""
Simple test script to convert markdown to PDF
"""

import sys
import os
from pathlib import Path

print("=== PDF Converter Debug ===")
print(f"Python version: {sys.version}")
print(f"Working directory: {os.getcwd()}")

try:
    from reportlab.lib.pagesizes import A4
    from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
    from reportlab.lib.units import inch
    from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, PageBreak
    from reportlab.lib import colors
    from reportlab.lib.enums import TA_CENTER, TA_JUSTIFY
    print("✓ ReportLab imported successfully")
except ImportError as e:
    print(f"✗ Failed to import reportlab: {e}")
    sys.exit(1)

workspace_dir = Path(r"b:\biometric_security\BioSecure_offline_Copy")
md_file = workspace_dir / "BioSecure_Comprehensive_Report.md"
pdf_file = workspace_dir / "BioSecure_Comprehensive_Report.pdf"

print(f"Markdown file: {md_file}")
print(f"  Exists: {md_file.exists()}")
if md_file.exists():
    print(f"  Size: {md_file.stat().st_size} bytes")

print(f"PDF output: {pdf_file}")

try:
    # Read markdown
    with open(md_file, 'r', encoding='utf-8') as f:
        md_content = f.read()
    print(f"✓ Markdown file read successfully ({len(md_content)} bytes)")
    
    # Create PDF
    doc = SimpleDocTemplate(
        str(pdf_file),
        pagesize=A4,
        rightMargin=0.75*inch,
        leftMargin=0.75*inch,
        topMargin=0.75*inch,
        bottomMargin=0.75*inch,
        title="BioSecure Login - Comprehensive Report"
    )
    print("✓ PDF document created")
    
    # Create stylesheet
    styles = getSampleStyleSheet()
    
    title_style = ParagraphStyle(
        'CustomTitle',
        parent=styles['Heading1'],
        fontSize=24,
        textColor=colors.HexColor('#0066cc'),
        spaceAfter=20,
        alignment=TA_CENTER,
        fontName='Helvetica-Bold'
    )
    
    body_style = ParagraphStyle(
        'CustomBody',
        parent=styles['BodyText'],
        fontSize=11,
        alignment=TA_JUSTIFY,
        spaceAfter=10
    )
    
    # Build story
    story = []
    lines = md_content.split('\n')
    
    count = 0
    for line in lines[:50]:  # Just process first 50 lines
        if line.startswith('# '):
            text = line[2:].strip()
            story.append(Paragraph(text, title_style))
            story.append(Spacer(1, 0.1*inch))
            count += 1
        elif line.strip() and not line.startswith('#'):
            text = line.strip()[:100]  # Limit text length
            story.append(Paragraph(text, body_style))
            count += 1
    
    print(f"✓ Built story with {count} elements")
    
    # Build PDF
    doc.build(story)
    print("✓ PDF built successfully")
    
    # Check result
    if pdf_file.exists():
        size = pdf_file.stat().st_size
        print(f"✓✓✓ PDF CREATED SUCCESSFULLY ✓✓✓")
        print(f"  File: {pdf_file}")
        print(f"  Size: {size / 1024:.2f} KB")
    else:
        print("✗ PDF file was not created")
        
except Exception as e:
    print(f"✗ Error: {e}")
    import traceback
    traceback.print_exc()
    sys.exit(1)
