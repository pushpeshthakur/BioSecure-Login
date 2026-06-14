#!/usr/bin/env python3
"""
Convert Markdown report to PDF using reportlab
Simple, robust converter without complex HTML/markdown parsing
"""

import os
import re
from pathlib import Path
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import inch
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, PageBreak
from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_LEFT, TA_JUSTIFY

# Paths
workspace_dir = Path(r"b:\biometric_security\BioSecure_offline_Copy")
md_file = workspace_dir / "BioSecure_Comprehensive_Report.md"
pdf_file = workspace_dir / "BioSecure_Comprehensive_Report.pdf"

def escape_text(text):
    """Escape special characters for reportlab"""
    text = str(text)
    text = text.replace('&', '&amp;')
    text = text.replace('<', '&lt;')
    text = text.replace('>', '&gt;')
    return text

def process_formatting(text):
    """Process markdown formatting to reportlab XML-style formatting"""
    text = escape_text(text)
    # Don't use complex formatting that could break XML parsing
    return text

def markdown_to_pdf():
    """Convert markdown to PDF using reportlab"""
    try:
        print(f"Reading markdown file: {md_file}")
        
        if not md_file.exists():
            print(f"Error: Markdown file not found at {md_file}")
            return False
        
        with open(md_file, 'r', encoding='utf-8') as f:
            md_content = f.read()
        
        print(f"Markdown file size: {len(md_content)} bytes")
        print(f"Creating PDF: {pdf_file}")
        
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
        
        # Create stylesheet
        styles = getSampleStyleSheet()
        
        # Custom styles
        title_style = ParagraphStyle(
            'CustomTitle',
            parent=styles['Heading1'],
            fontSize=24,
            textColor=colors.HexColor('#0066cc'),
            spaceAfter=20,
            alignment=TA_CENTER,
            fontName='Helvetica-Bold'
        )
        
        heading1_style = ParagraphStyle(
            'CustomHeading1',
            parent=styles['Heading1'],
            fontSize=16,
            textColor=colors.HexColor('#0066cc'),
            spaceAfter=12,
            spaceBefore=12,
            fontName='Helvetica-Bold'
        )
        
        heading2_style = ParagraphStyle(
            'CustomHeading2',
            parent=styles['Heading2'],
            fontSize=14,
            textColor=colors.HexColor('#004999'),
            spaceAfter=10,
            spaceBefore=10,
            fontName='Helvetica-Bold'
        )
        
        heading3_style = ParagraphStyle(
            'CustomHeading3',
            parent=styles['Heading3'],
            fontSize=12,
            textColor=colors.HexColor('#004999'),
            spaceAfter=8,
            spaceBefore=8,
            fontName='Helvetica-Bold'
        )
        
        body_style = ParagraphStyle(
            'CustomBody',
            parent=styles['BodyText'],
            fontSize=10,
            alignment=TA_JUSTIFY,
            spaceAfter=8,
            leading=12
        )
        
        code_style = ParagraphStyle(
            'CustomCode',
            parent=styles['Normal'],
            fontSize=8,
            fontName='Courier',
            leftIndent=20,
            rightIndent=20,
            textColor=colors.HexColor('#333333'),
            spaceAfter=8,
            leading=9
        )
        
        # Parse markdown and build story
        story = []
        lines = md_content.split('\n')
        
        in_code_block = False
        code_buffer = []
        
        i = 0
        while i < len(lines):
            line = lines[i]
            
            # Handle code blocks
            if line.startswith('```'):
                if not in_code_block:
                    in_code_block = True
                    code_buffer = []
                else:
                    in_code_block = False
                    if code_buffer:
                        code_lines = [escape_text(l) for l in code_buffer]
                        # Split long code lines
                        for code_line in code_lines:
                            if code_line.strip():
                                story.append(Paragraph(code_line[:200], code_style))
                        story.append(Spacer(1, 0.15*inch))
                i += 1
                continue
            
            if in_code_block:
                code_buffer.append(line)
                i += 1
                continue
            
            # Handle headings
            if line.startswith('# '):
                text = escape_text(line[2:].strip())
                story.append(Paragraph(text, title_style))
                story.append(Spacer(1, 0.15*inch))
                i += 1
                continue
            
            if line.startswith('## '):
                text = escape_text(line[3:].strip())
                story.append(Paragraph(text, heading1_style))
                story.append(Spacer(1, 0.1*inch))
                i += 1
                continue
            
            if line.startswith('### '):
                text = escape_text(line[4:].strip())
                story.append(Paragraph(text, heading2_style))
                story.append(Spacer(1, 0.08*inch))
                i += 1
                continue
            
            if line.startswith('#### '):
                text = escape_text(line[5:].strip())
                story.append(Paragraph(text, heading3_style))
                story.append(Spacer(1, 0.08*inch))
                i += 1
                continue
            
            # Handle horizontal rules
            if line.strip().startswith('---'):
                story.append(PageBreak())
                i += 1
                continue
            
            # Handle empty lines
            if not line.strip():
                story.append(Spacer(1, 0.08*inch))
                i += 1
                continue
            
            # Handle paragraphs
            if line.strip() and len(line.strip()) > 3:
                text = escape_text(line.strip())
                # Split very long lines
                if len(text) > 150:
                    story.append(Paragraph(text[:150], body_style))
                else:
                    story.append(Paragraph(text, body_style))
            
            i += 1
        
        # Build PDF
        print("Building PDF document...")
        doc.build(story)
        
        # Verify PDF was created
        if pdf_file.exists():
            pdf_size = pdf_file.stat().st_size
            print(f"\n✓ PDF created successfully!")
            print(f"  File: {pdf_file}")
            print(f"  Size: {pdf_size / 1024:.2f} KB")
            return True
        else:
            print(f"Error: PDF file was not created")
            return False
            
    except ImportError as e:
        print(f"Error: Required library not installed: {e}")
        print("Install with: pip install reportlab")
        return False
    except Exception as e:
        print(f"Error during conversion: {e}")
        import traceback
        traceback.print_exc()
        return False

if __name__ == "__main__":
    success = markdown_to_pdf()
    exit(0 if success else 1)
