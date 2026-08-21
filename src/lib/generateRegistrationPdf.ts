// src/lib/generateRegistrationPdf.ts
import jsPDF from 'jspdf';
import { SubCompetition, AttendeeCategory } from '@/components/EventRegistration';
import { getApplicableCategoriesForType } from '@/lib/db';

interface EventPdfData {
  name: string;
  type?: 'event' | 'celebration' | 'summit' | 'workshop' | 'conference';
  date?: string;
  venue_name?: string;
  venue_Name?: string;
  location?: string;
  isMultiCompetition?: boolean;
  competitions?: SubCompetition[];
}

const ATTENDEE_CATEGORY_KEYS: AttendeeCategory[] = [
  'patron',
  'dignitary',
  'vip',
  'sponsor',
  'speaker',
  'artisan',
  'delegate',
  'trainee',
  'exhibitor',
  'general-public',
  'event-participant',
  'ops-team'
];

const PUBLIC_EXCLUSIVE_CATEGORIES: AttendeeCategory[] = [
  'sponsor',
  'speaker',
  'artisan',
  'delegate',
  'trainee',
  'exhibitor',
  'general-public',
  'event-participant'
];

// Multilingual labels for attendee categories (English / हिन्दी / मैथिली)
const CATEGORY_LABELS: Record<AttendeeCategory, { en: string; hi: string; mai: string }> = {
  'event-participant': { en: 'Event Participant', hi: 'प्रतिभागी', mai: 'प्रतिभागी' },
  'general-public': { en: 'General Public / Visitor', hi: 'सामान्य दर्शक', mai: 'सामान्य दर्शक' },
  'delegate': { en: 'Delegate', hi: 'प्रतिनिधि', mai: 'प्रतिनिधि' },
  'artisan': { en: 'Artisan', hi: 'शिल्पकार / कलाकार', mai: 'शिल्पकार / कलाकार' },
  'exhibitor': { en: 'Exhibitor / Stall', hi: 'प्रदर्शक / स्टॉल', mai: 'प्रदर्शक / स्टॉल' },
  'trainee': { en: 'Trainee', hi: 'प्रशिक्षु / छात्र', mai: 'प्रशिक्षु / छात्र' },
  'speaker': { en: 'Speaker / Panelist', hi: 'वक्ता', mai: 'वक्ता' },
  'sponsor': { en: 'Sponsor', hi: 'प्रायोजक', mai: 'प्रायोजक' },
  'vip': { en: 'VIP Guest', hi: 'विशिष्ट अतिथि', mai: 'विशिष्ट अतिथि' },
  'dignitary': { en: 'Dignitary', hi: 'मान्यवर', mai: 'मान्यवर' },
  'patron': { en: 'Patron', hi: 'संरक्षक', mai: 'संरक्षक' },
  'ops-team': { en: 'Operations Team', hi: 'प्रबंधन दल', mai: 'प्रबंधन दल' }
};

export async function generateBlankRegistrationPdf(event: EventPdfData) {
  const formatAgeBadge = (min?: number, max?: number) => {
    if (min !== undefined && max !== undefined) return `${min}–${max} yrs / वर्ष`;
    if (min !== undefined) return `≥ ${min} yrs / वर्ष`;
    if (max !== undefined) return `≤ ${max} yrs / वर्ष`;
    return 'Open Bracket / सभ आयु वर्ग';
  };

  const eventType = event.type || 'event';
  const applicableCategories = getApplicableCategoriesForType(eventType);
  const activeCategories = ATTENDEE_CATEGORY_KEYS.filter(
    (cat) => applicableCategories.includes(cat) && PUBLIC_EXCLUSIVE_CATEGORIES.includes(cat)
  );

  const venueDisplayName = event.venue_name || event.venue_Name || event.location || 'Main Venue / मुख्य आयोजन स्थल';

  const printContainer = document.createElement('div');
  printContainer.style.position = 'fixed';
  printContainer.style.top = '-9999px';
  printContainer.style.left = '-9999px';
  printContainer.style.width = '794px'; // 96 DPI A4 standard width[cite: 7]
  printContainer.style.minHeight = '1123px'; // 96 DPI A4 standard height[cite: 7]
  printContainer.style.backgroundColor = '#ffffff';
  printContainer.style.color = '#0f172a';
  printContainer.style.fontFamily = "'Noto Sans Devanagari', 'Mukta', 'Arial', sans-serif";
  printContainer.style.padding = '24px 32px';
  printContainer.style.boxSizing = 'border-box';

  const competitionsList = event.competitions || [];

  printContainer.innerHTML = `
    <div style="border: 2px solid #0f172a; padding: 18px; border-radius: 8px; font-size: 12px; line-height: 1.45; box-sizing: border-box;">
      
      <!-- HEADER & BRANDING -->
      <div style="background-color: #0f172a; color: #ffffff; padding: 12px 16px; border-radius: 6px; margin-bottom: 14px;">
        <div style="font-size: 17px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.5px; line-height: 1.2;">
          ${event.name || 'OFFICIAL EVENT REGISTRATION FORM'}
        </div>
        <div style="font-size: 11.5px; font-weight: bold; color: #e2e8f0; margin-top: 3px; line-height: 1.3;">
          आधिकारिक पंजीकरण एवं आवेदन प्रपत्र (मैथिली / हिन्दी / English)
        </div>
        <div style="font-size: 9.5px; color: #94a3b8; margin-top: 5px; display: flex; justify-content: space-between; border-top: 1px solid #334155; padding-top: 4px;">
          <span><strong>Date / तिथि:</strong> ${event.date || 'TBA'}</span>
          <span><strong>Venue / आयोजन स्थल (स्थान):</strong> ${venueDisplayName}</span>
        </div>
      </div>

      <!-- MANDATORY NOTICE (TRILINGUAL) -->
      <div style="background-color: #fef3c7; border: 1px solid #f59e0b; border-radius: 6px; padding: 8px 12px; margin-bottom: 16px; font-size: 9.5px; color: #92400e; line-height: 1.4;">
        <div style="font-weight: 800; text-transform: uppercase; font-size: 10px; color: #78350f; margin-bottom: 3px;">
          ⚠️ Mandatory Verification Notice / अनिवार्य सत्यापन सूचना / आवश्यक निर्देश:
        </div>
        <div style="margin-bottom: 2px;">
          • <strong>English:</strong> All participants must bring original and photocopy of own Aadhar card while coming to event for age verification.
        </div>
        <div style="margin-bottom: 2px;">
          • <strong>हिन्दी:</strong> सभी प्रतिभागियों को कार्यक्रम में आते समय आयु सत्यापन के लिए अपने आधार कार्ड की मूल प्रति और फोटोकॉपी साथ लाना अनिवार्य है।
        </div>
        <div>
          • <strong>मैथिली:</strong> सब प्रतिभागी उम्र सत्यापन के लेल आयोजन में आबय के समय अपन आधार कार्ड के मूल आ फोटोकॉपी जरूर ल क आबय।
        </div>
      </div>

      <!-- SECTION 1: PARTICIPANT DETAILS (FULL WIDTH - PHOTO REMOVED) -->
      <div style="margin-bottom: 16px;">
        <div style="font-size: 12px; font-weight: 800; border-bottom: 1.5px solid #0f172a; padding-bottom: 3px; margin-bottom: 12px;">
          1. Participant Details / प्रतिभागीक विवरण (In BLOCK letters)
        </div>

        <!-- Full Name Field -->
        <div style="margin-bottom: 12px;">
          <label style="display: block; font-size: 9.5px; font-weight: 700; color: #334155; margin-bottom: 6px; line-height: 1.2;">
            Full Name / पूरा नाम (हिन्दी/English) *
          </label>
          <div style="height: 26px; border: 1.2px solid #cbd5e1; border-radius: 4px; background: #fafafa;"></div>
        </div>

        <!-- Mobile & Email Two-Column Grid -->
        <div style="display: flex; gap: 12px; margin-bottom: 12px;">
          <div style="flex: 1;">
            <label style="display: block; font-size: 9.5px; font-weight: 700; color: #334155; margin-bottom: 6px; line-height: 1.2;">
              Mobile No. / WhatsApp मोबाइल / व्हाट्सएप नंबर (10 Digits) *
            </label>
            <div style="height: 26px; border: 1.2px solid #cbd5e1; border-radius: 4px; background: #fafafa;"></div>
          </div>
          <div style="flex: 1;">
            <label style="display: block; font-size: 9.5px; font-weight: 700; color: #334155; margin-bottom: 6px; line-height: 1.2;">
              Email ID / ईमेल आईडी
            </label>
            <div style="height: 26px; border: 1.2px solid #cbd5e1; border-radius: 4px; background: #fafafa;"></div>
          </div>
        </div>

        <!-- Address & Venue Info Grid -->
        <div style="display: flex; gap: 12px; margin-bottom: 4px;">
          <div style="flex: 1;">
            <label style="display: block; font-size: 9.5px; font-weight: 700; color: #334155; margin-bottom: 6px; line-height: 1.2;">
              Village, City & Address / गाम, शहर आ पता *
            </label>
            <div style="height: 26px; border: 1.2px solid #cbd5e1; border-radius: 4px; background: #fafafa;"></div>
          </div>
          <div style="flex: 1;">
            <label style="display: block; font-size: 9.5px; font-weight: 700; color: #334155; margin-bottom: 6px; line-height: 1.2;">
              Assigned Venue / निर्धारित आयोजन स्थल
            </label>
            <div style="height: 26px; border: 1.2px solid #cbd5e1; border-radius: 4px; background: #f1f5f9; padding: 4px 8px; font-size: 9.5px; font-weight: 600; color: #475569; display: flex; align-items: center;">
              ${venueDisplayName}
            </div>
          </div>
        </div>
      </div>

      <!-- SECTION 2: ATTENDEE CATEGORY (RESTRICTED TO DIGITAL FORM OPTIONS) -->
      <div style="margin-bottom: 16px;">
        <div style="font-size: 12px; font-weight: 800; border-bottom: 1.5px solid #0f172a; padding-bottom: 3px; margin-bottom: 8px; display: flex; justify-content: space-between; align-items: baseline;">
          <span>2. Entry Category / श्रेणी चयन</span>
          <span style="font-size: 9px; font-weight: normal; color: #64748b;">(Tick any one applicable category)</span>
        </div>
        <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 8px; font-size: 9.5px; color: #334155; padding-top: 2px;">
          ${activeCategories.map((catKey) => {
            const labelObj = CATEGORY_LABELS[catKey] || { en: catKey, hi: catKey, mai: catKey };
            return `
              <div style="display: flex; align-items: center; gap: 5px; border: 1px solid #e2e8f0; padding: 5px 8px; border-radius: 4px; background: #fafafa;">
                <span style="font-family: monospace; font-size: 11px;">[ &nbsp; ]</span>
                <span><strong>${labelObj.en}</strong> / ${labelObj.hi}</span>
              </div>
            `;
          }).join('')}
        </div>
      </div>

      <!-- SECTION 3: ALL COMPETITIONS & AGE GROUPS GRID -->
      ${event.isMultiCompetition && competitionsList.length > 0 ? `
        <div style="margin-bottom: 16px;">
          <div style="font-size: 12px; font-weight: 800; border-bottom: 1.5px solid #0f172a; padding-bottom: 3px; margin-bottom: 8px; display: flex; justify-content: space-between; align-items: baseline;">
            <span>3. Select Competition Track & Age Group / प्रतियोगिता एवं आयु वर्ग</span>
            <span style="font-size: 9px; font-weight: normal; color: #64748b;">(Tick your selected track & group)</span>
          </div>

          <div style="display: flex; flex-direction: column; gap: 8px;">
            ${competitionsList.map((comp) => `
              <div style="border: 1px solid #e2e8f0; border-radius: 6px; padding: 7px 10px; background: #fafafa;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 5px;">
                  <span style="font-size: 10px; font-weight: 800; color: #0f172a;">
                    [ &nbsp; ] [${comp.code}] ${comp.title} ${comp.category ? `(${comp.category})` : ''}
                  </span>
                </div>
                
                ${comp.ageGroups && comp.ageGroups.length > 0 ? `
                  <div style="display: flex; flex-wrap: wrap; gap: 10px; font-size: 9px; color: #475569; padding-left: 14px;">
                    ${comp.ageGroups.map(grp => `
                      <span style="display: inline-flex; align-items: center; gap: 3px;">
                        ( &nbsp; ) ${grp.label} <strong>[${grp.code}]</strong> (${formatAgeBadge(grp.minAge, grp.maxAge)})
                      </span>
                    `).join('')}
                  </div>
                ` : `
                  <div style="font-size: 9px; color: #64748b; padding-left: 14px;">
                    ( &nbsp; ) Open Age Bracket / सभ वर्ग लेल उपलब्ध
                  </div>
                `}
              </div>
            `).join('')}
          </div>
        </div>
      ` : ''}

      <!-- SECTION 4: DECLARATION & SIGNATURES -->
      <div style="margin-bottom: 14px; font-size: 8.5px; color: #475569; line-height: 1.35; background: #f8fafc; border: 1px solid #e2e8f0; padding: 6px 10px; border-radius: 4px;">
        <div style="font-weight: 800; color: #0f172a; font-size: 9.5px; margin-bottom: 2px;">
          Declaration / घोषणा आ सहमति:
        </div>
        <div>
          हम घोषणा करैत छी जे उपर्युक्त सभ जानकारी हमर जानकारी मे सत्य आ सही अछि। हम आयोजन समिति क' सभ नियम आ अनुशासनक पालन करब।
          (I declare that the information provided above is true to the best of my knowledge and agree to follow all event guidelines.)
        </div>
      </div>

      <!-- Signature Row -->
      <div style="display: flex; justify-content: space-between; align-items: flex-end; margin-top: 26px; padding: 0 16px; margin-bottom: 16px;">
        <div style="text-align: center;">
          <div style="width: 170px; border-top: 1.2px solid #64748b; margin-bottom: 4px;"></div>
          <div style="font-size: 9px; font-weight: 700; color: #1e293b;">Participant's Signature / Thumb</div>
          <div style="font-size: 8px; color: #64748b;">प्रतिभागीक हस्ताक्षर / अँगूठाक निशान</div>
        </div>
      </div>

    </div>
  `;

  document.body.appendChild(printContainer);

  try {
    const html2canvasModule = await import('html2canvas');
    const html2canvas = html2canvasModule.default || html2canvasModule;

    const canvas = await html2canvas(printContainer, {
      scale: 2,
      useCORS: true,
      logging: false,
      backgroundColor: '#ffffff'
    });

    const imgData = canvas.toDataURL('image/jpeg', 0.95);
    const pdf = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4'
    });

    const imgWidth = 210;
    const pageHeight = 297;
    const imgHeight = (canvas.height * imgWidth) / canvas.width;

    pdf.addImage(imgData, 'JPEG', 0, 0, imgWidth, Math.min(imgHeight, pageHeight));

    const filename = `${(event.name || 'event').toLowerCase().replace(/\s+/g, '-')}-offline-form.pdf`;
    pdf.save(filename);
  } catch (err) {
    console.error('Failed to generate Canvas PDF, falling back to basic PDF:', err);
    
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    doc.setFontSize(14);
    doc.text((event.name || 'EVENT REGISTRATION FORM').toUpperCase(), 14, 15);
    doc.setFontSize(9);
    doc.text(`Date / तिथि: ${event.date || 'TBA'} | Venue / आयोजन स्थल: ${venueDisplayName}`, 14, 22);
    doc.text('Participant Name / नाम: _________________________________________', 14, 35);
    doc.text('Mobile Number / मोबाइल (10 Digits): _______________________________', 14, 45);
    doc.text('Email Address / ईमेल: ___________________________________________', 14, 55);
    doc.text('Selected Track & Age Group / वर्ग: _______________________________', 14, 65);
    doc.save(`${(event.name || 'event').toLowerCase().replace(/\s+/g, '-')}-form.pdf`);
  } finally {
    document.body.removeChild(printContainer);
  }
}