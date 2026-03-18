from typing import Any, List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy.orm import selectinload
import datetime

from app.api.deps import get_db, get_current_active_user
from app.models.submission import DataSubmission
from app.models.checklist import CompanyChecklist
from app.models.data_element import DataElement
from app.models.meter import Meter
from app.models.user import User

from app.models.report import GeneratedReport

router = APIRouter()

@router.get("/", response_model=List[dict])
async def list_reports(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
) -> Any:
    """
    Returns the list of reports generated for the company.
    """
    company_id = current_user.profile.company_id
    if not company_id:
        raise HTTPException(status_code=403, detail="Not assigned to a company")

    stmt = select(GeneratedReport).where(GeneratedReport.company_id == company_id).order_by(GeneratedReport.created_at.desc())
    reports = (await db.execute(stmt)).scalars().all()
    
    return [
        {
            "id": r.id,
            "name": r.name,
            "category": r.category,
            "format": r.format,
            "date": r.created_at.strftime("%Y-%m-%d"),
            "size": r.size,
            "year": r.year,
            "download_url": r.download_url
        }
        for r in reports
    ]

@router.get("/check-completion/{year}")
async def check_report_completion(
    year: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
) -> Any:
    # ... (same logic as before)
    company_id = current_user.profile.company_id
    if not company_id:
        raise HTTPException(status_code=403, detail="Not assigned to a company")

    # 1. Fetch all required checklist items
    stmt_checklist = (
        select(CompanyChecklist)
        .options(selectinload(CompanyChecklist.data_element))
        .where(CompanyChecklist.company_id == company_id, CompanyChecklist.is_required == True)
    )
    checklist_records = (await db.execute(stmt_checklist)).scalars().all()

    # 2. Fetch all active meters
    stmt_meters = select(Meter).where(
        Meter.company_id == company_id,
        Meter.is_active == True
    )
    meters_records = (await db.execute(stmt_meters)).scalars().all()
    meters_by_element = {}
    for m in meters_records:
        if m.data_element_id not in meters_by_element:
            meters_by_element[m.data_element_id] = []
        meters_by_element[m.data_element_id].append(m)

    # 3. Fetch all submissions for the year
    stmt_subs = select(DataSubmission).where(
        DataSubmission.company_id == company_id,
        DataSubmission.year == year
    )
    subs_records = (await db.execute(stmt_subs)).scalars().all()
    subs_lookup = set((s.data_element_id, s.meter_id, s.month) for s in subs_records if s.value is not None)

    missing = []
    total_expected = 0
    total_filled = 0

    for item in checklist_records:
        element = item.data_element
        if not element: continue
        
        freq = element.collection_frequency.lower()
        months_to_check = range(1, 13) if freq in ["monthly", "daily"] else [12]
        element_meters = meters_by_element.get(element.id, [])
        
        if element_meters and element.is_metered:
            for m in element_meters:
                for month in months_to_check:
                    total_expected += 1
                    if (element.id, m.id, month) not in subs_lookup:
                        missing.append({"element_name": element.name, "meter_name": m.name, "month": month, "type": "Meter Data"})
                    else:
                        total_filled += 1
        else:
            for month in months_to_check:
                total_expected += 1
                if (element.id, None, month) not in subs_lookup:
                    missing.append({"element_name": element.name, "meter_name": None, "month": month, "type": "General Data"})
                else:
                    total_filled += 1

    completion_pct = (total_filled / total_expected * 100) if total_expected > 0 else 100

    return {
        "is_complete": len(missing) == 0,
        "completion_percentage": round(completion_pct, 1),
        "missing_count": len(missing),
        "missing_items": missing[:20],
        "total_expected": total_expected,
        "total_filled": total_filled
    }

@router.post("/generate/{year}")
async def generate_report(
    year: int,
    allow_incomplete: bool = False,
    format: str = 'PDF',
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
) -> Any:
    status = await check_report_completion(year, db, current_user)
    if not status["is_complete"] and not allow_incomplete:
        raise HTTPException(
            status_code=400, 
            detail={
                "msg": "Cannot generate report: data is incomplete.",
                "missing_count": status["missing_count"]
            }
        )
    
    # Create persistent record
    report_name = f"Full ESG Report {year}"
    new_report = GeneratedReport(
        company_id=current_user.profile.company_id,
        user_id=current_user.id,
        name=report_name,
        year=year,
        category='Full ESG',
        format=format.upper(),
        size='1.2 MB' if format.upper() == 'PDF' else '850 KB',
        status='Completed',
        download_url=f"/reports/download/REPORT_ID_PLACEHOLDER"
    )
    db.add(new_report)
    await db.commit()
    await db.refresh(new_report)
    
    # Update download URL with real ID
    new_report.download_url = f"/reports/download/{new_report.id}"
    await db.commit()

    return {
        "msg": "Report generated successfully",
        "report_id": new_report.id,
        "name": new_report.name,
        "download_url": new_report.download_url
    }

@router.delete("/{report_id}")
async def delete_report(
    report_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
) -> Any:
    company_id = current_user.profile.company_id
    stmt = select(GeneratedReport).where(
        GeneratedReport.id == report_id,
        GeneratedReport.company_id == company_id
    )
    report = (await db.execute(stmt)).scalar_one_or_none()
    
    if not report:
        raise HTTPException(status_code=404, detail="Report not found")
        
    await db.delete(report)
    await db.commit()
    return {"msg": "Report deleted successfully"}

from fastapi.responses import Response, StreamingResponse
import io
from reportlab.lib.pagesizes import letter
from reportlab.pdfgen import canvas
from reportlab.lib import colors
from reportlab.lib.units import inch
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
import xlsxwriter

async def generate_pdf_report(report, company_name: str, submissions: List[DataSubmission]):
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(buffer, pagesize=letter)
    styles = getSampleStyleSheet()
    elements = []

    # Title
    elements.append(Paragraph(f"ESG Disclosure Report - FY {report.year}", styles['Title']))
    elements.append(Paragraph(f"Company: {company_name}", styles['Heading2']))
    elements.append(Paragraph(f"Generated on: {report.created_at.strftime('%Y-%m-%d %H:%M')}", styles['Normal']))
    elements.append(Spacer(1, 0.2*inch))

    # Summary
    elements.append(Paragraph("Reporting Summary", styles['Heading3']))
    summary_text = f"This document contains the official ESG disclosures for {company_name} for the fiscal year {report.year}."
    elements.append(Paragraph(summary_text, styles['Normal']))
    elements.append(Spacer(1, 0.3*inch))

    # Data Table
    table_data = [['Element', 'Meter', 'Month', 'Value', 'Unit']]
    for s in submissions:
        table_data.append([
            f"ID: {s.data_element_id}", 
            f"Meter: {s.meter_id}" if s.meter_id else "General", 
            str(s.month), 
            str(s.value) if s.value is not None else "0.00", 
            s.unit or "-"
        ])

    if len(table_data) > 1:
        t = Table(table_data, colWidths=[1.8*inch, 1.8*inch, 0.8*inch, 1.2*inch, 1*inch])
        t.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#6366f1')),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
            ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('GRID', (0, 0), (-1, -1), 1, colors.HexColor('#e2e8f0'))
        ]))
        elements.append(t)
    else:
        elements.append(Paragraph("No data points found.", styles['Italic']))

    doc.build(elements)
    val = buffer.getvalue()
    buffer.close()
    return val

async def generate_excel_report(report, company_name: str, submissions: List[DataSubmission]):
    output = io.BytesIO()
    workbook = xlsxwriter.Workbook(output, {'in_memory': True})
    worksheet = workbook.add_worksheet("ESG Data")

    header_fmt = workbook.add_format({'bold': True, 'font_color': 'white', 'bg_color': '#6366f1'})
    
    worksheet.write(0, 0, f"ESG Disclosure Report - {company_name}")
    worksheet.write(1, 0, f"Fiscal Year: {report.year}")
    
    headers = ['Element ID', 'Meter ID', 'Month', 'Value', 'Unit', 'Date']
    for col, h in enumerate(headers):
        worksheet.write(3, col, h, header_fmt)

    for row, s in enumerate(submissions, start=4):
        worksheet.write(row, 0, s.data_element_id)
        worksheet.write(row, 1, s.meter_id if s.meter_id else "General")
        worksheet.write(row, 2, s.month)
        # Convert Decimal to float for XlsxWriter
        val = float(s.value) if s.value is not None else 0.0
        worksheet.write(row, 3, val)
        worksheet.write(row, 4, s.unit or "-")
        worksheet.write(row, 5, s.submitted_at.strftime("%Y-%m-%d"))

    workbook.close()
    data = output.getvalue()
    output.close()
    return data

@router.get("/download/{report_id}")
async def download_report(
    report_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
) -> Any:
    company_id = current_user.profile.company_id
    stmt = (
        select(GeneratedReport)
        .options(selectinload(GeneratedReport.company))
        .where(
            GeneratedReport.id == report_id,
            GeneratedReport.company_id == company_id
        )
    )
    report = (await db.execute(stmt)).scalar_one_or_none()
    
    if not report:
        raise HTTPException(status_code=404, detail="Report not found")

    # Fetch submissions for accurate data
    stmt_subs = select(DataSubmission).where(
        DataSubmission.company_id == company_id,
        DataSubmission.year == report.year
    )
    submissions = (await db.execute(stmt_subs)).scalars().all()
    company_name = report.company.name if report.company else "Your Company"

    filename = f"{report.name.replace(' ', '_')}_{report.year}.{report.format.lower()}"
    
    if report.format.upper() == 'PDF':
        content = await generate_pdf_report(report, company_name, submissions)
        media_type = "application/pdf"
    else:
        content = await generate_excel_report(report, company_name, submissions)
        media_type = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    
    return StreamingResponse(
        io.BytesIO(content),
        media_type=media_type,
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )
