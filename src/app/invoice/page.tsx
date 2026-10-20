'use client';

import React from 'react';
import Image from 'next/image';
import { Inter, Great_Vibes } from 'next/font/google';
import { 
  MapPin, 
  Phone, 
  Mail, 
  Globe,
  Printer,
  Copy,
  BookOpen,
  Layers
} from 'lucide-react';

const inter = Inter({ subsets: ['latin'], weight: ['400', '500', '600', '700'] });
const greatVibes = Great_Vibes({ subsets: ['latin'], weight: ['400'] });

const invoiceData = {
  invoiceNumber: 'ADL/INV/2025/0458',
  invoiceDate: '03 May 2025',
  dueDate: '17 May 2025',
  billTo: {
    company: 'M/s. ABC Enterprises',
    address1: '45, Park Street,',
    address2: 'R.S. Puram, Coimbatore - 641 002',
    state: 'Tamil Nadu, India',
    phone: '+91 98989 98989',
    email: 'abcenterprises@gmail.com',
    gstin: '33ABCDE1234F1Z5'
  },
  shipTo: {
    company: 'M/s. ABC Enterprises',
    address1: '45, Park Street,',
    address2: 'R.S. Puram, Coimbatore - 641 002',
    state: 'Tamil Nadu, India'
  },
  items: [
    { desc: 'Visiting Cards - 300 GSM Art Card', size: '9 x 5.5 cm', qty: '1000 Nos', rate: 700.00, amount: 700.00 },
    { desc: 'Letter Heads - 100 GSM', size: 'A4', qty: '500 Nos', rate: 850.00, amount: 850.00 },
    { desc: 'Brochure (4 Page) - 130 GSM', size: 'A4 (Folded)', qty: '500 Nos', rate: 2500.00, amount: 2500.00 },
    { desc: 'Bill Books - 100 Sheets', size: '1/4 Size', qty: '10 Nos', rate: 600.00, amount: 600.00 },
    { desc: 'Flex Printing', size: '4 x 3 ft', qty: '1 No', rate: 450.00, amount: 450.00 },
    { desc: 'Lamination - Gloss', size: 'A4', qty: '20 Nos', rate: 50.00, amount: 50.00 },
  ],
  financials: {
    subtotal: 5150.00,
    discount: 150.00,
    cgst: 450.00,
    sgst: 450.00,
    total: 5900.00,
    amountInWords: 'Rupees Five Thousand Nine Hundred Only'
  },
  bank: {
    name: 'HDFC Bank',
    accountName: 'ADDESIGNER Laser Printer',
    accountNo: '1234 5678 9012 34',
    ifsc: 'HDFC0001234',
    branch: 'Coimbatore - Main'
  }
};

export default function InvoicePage() {
  return (
    <div className={`min-h-screen bg-slate-100 py-12 print:py-0 print:bg-white flex justify-center ${inter.className}`}>
      
      <div className="w-[850px] bg-white shadow-2xl print:shadow-none print:w-[210mm] print:h-[297mm] rounded-3xl print:rounded-none overflow-hidden flex flex-col relative border-t-[12px] border-[#001B44]">
        
        {/* Background Watermark */}
        <div className="absolute inset-0 z-0 flex items-center justify-center opacity-[0.03] pointer-events-none select-none">
          <span className="text-[250px] font-black italic tracking-tighter text-black transform -rotate-12">Add</span>
        </div>

        {/* Content Wrapper */}
        <div className="relative z-10 p-10 flex-1 flex flex-col">
          
          {/* Header */}
          <div className="flex justify-between items-start mb-6">
            <div className="flex flex-col">
              <Image unoptimized src="/assets/logo.png?v=2" alt="Logo" width={280} height={80} className="object-contain" />
              <div className="flex items-center gap-4 mt-4 text-[9px] font-bold text-[#001B44] tracking-widest uppercase">
                <span className="flex items-center gap-1"><Printer size={12} className="text-pink-600"/> Offset Printing</span>
                <span className="flex items-center gap-1"><Copy size={12} className="text-cyan-500"/> Digital Printing</span>
                <span className="flex items-center gap-1"><BookOpen size={12} className="text-yellow-500"/> Xerox | Binding</span>
                <span className="flex items-center gap-1"><Layers size={12} className="text-gray-800"/> Lamination</span>
              </div>
            </div>

            <div className="flex flex-col items-end">
              <h1 className="text-[2.5rem] font-black text-[#001B44] tracking-wider mb-4">INVOICE</h1>
              <table className="w-[280px] text-xs border border-gray-200">
                <tbody>
                  <tr className="border-b border-gray-200 bg-gray-50">
                    <td className="py-2 px-3 font-semibold text-gray-700">Invoice No.</td>
                    <td className="py-2 px-3 text-center">:</td>
                    <td className="py-2 px-3 text-right font-medium">{invoiceData.invoiceNumber}</td>
                  </tr>
                  <tr className="border-b border-gray-200">
                    <td className="py-2 px-3 font-semibold text-gray-700">Invoice Date</td>
                    <td className="py-2 px-3 text-center">:</td>
                    <td className="py-2 px-3 text-right font-medium">{invoiceData.invoiceDate}</td>
                  </tr>
                  <tr className="bg-gray-50">
                    <td className="py-2 px-3 font-semibold text-gray-700">Due Date</td>
                    <td className="py-2 px-3 text-center">:</td>
                    <td className="py-2 px-3 text-right font-medium">{invoiceData.dueDate}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Contact Bar */}
          <div className="border-y border-gray-300 py-3 mb-8 flex justify-between items-center text-[10px] text-[#001B44] font-medium">
            <div className="flex items-center gap-2">
              <MapPin size={16} className="text-[#001B44]" />
              <span>123, Main Road, Gandhi Nagar,<br/>Coimbatore - 641 012, Tamil Nadu, India</span>
            </div>
            <div className="flex items-center gap-2 border-l border-gray-300 pl-4">
              <Phone size={14} className="text-[#001B44]" />
              <span>+91 98765 43210<br/>+91 93456 78901</span>
            </div>
            <div className="flex items-center gap-2 border-l border-gray-300 pl-4">
              <Mail size={14} className="text-[#001B44]" />
              <span>adddesignerprint@gmail.com</span>
            </div>
            <div className="flex items-center gap-2 border-l border-gray-300 pl-4">
              <Globe size={14} className="text-[#001B44]" />
              <span>www.adddesigner.in</span>
            </div>
          </div>

          {/* Client Info */}
          <div className="flex gap-12 mb-8">
            <div className="flex-1">
              <div className="bg-[#001B44] text-white text-[10px] font-bold px-3 py-1 inline-block rounded-sm mb-3">BILL TO</div>
              <div className="text-xs text-gray-800 leading-relaxed">
                <p className="font-bold text-sm text-[#001B44] mb-1">{invoiceData.billTo.company}</p>
                <p>{invoiceData.billTo.address1}</p>
                <p>{invoiceData.billTo.address2}</p>
                <p>{invoiceData.billTo.state}</p>
                <div className="mt-2 grid grid-cols-[50px_10px_1fr]">
                  <span>Phone</span><span>:</span><span className="font-medium">{invoiceData.billTo.phone}</span>
                  <span>Email</span><span>:</span><span className="font-medium">{invoiceData.billTo.email}</span>
                  <span>GSTIN</span><span>:</span><span className="font-medium">{invoiceData.billTo.gstin}</span>
                </div>
              </div>
            </div>
            <div className="flex-1">
              <div className="bg-[#001B44] text-white text-[10px] font-bold px-3 py-1 inline-block rounded-sm mb-3">SHIP TO</div>
              <div className="text-xs text-gray-800 leading-relaxed">
                <p className="font-bold text-sm text-[#001B44] mb-1">{invoiceData.shipTo.company}</p>
                <p>{invoiceData.shipTo.address1}</p>
                <p>{invoiceData.shipTo.address2}</p>
                <p>{invoiceData.shipTo.state}</p>
              </div>
            </div>
          </div>

          {/* Items Table */}
          <div className="flex-1 mb-6 border rounded-lg overflow-hidden border-gray-200">
            <table className="w-full text-xs text-left">
              <thead className="bg-[#001B44] text-white text-[10px]">
                <tr>
                  <th className="py-3 px-4 font-semibold w-12 text-center border-r border-white/20">S.No.</th>
                  <th className="py-3 px-4 font-semibold border-r border-white/20">DESCRIPTION</th>
                  <th className="py-3 px-4 font-semibold text-center border-r border-white/20">SIZE</th>
                  <th className="py-3 px-4 font-semibold text-center border-r border-white/20">QTY.</th>
                  <th className="py-3 px-4 font-semibold text-right border-r border-white/20">RATE (₹)</th>
                  <th className="py-3 px-4 font-semibold text-right">AMOUNT (₹)</th>
                </tr>
              </thead>
              <tbody className="text-gray-700">
                {invoiceData.items.map((item, index) => (
                  <tr key={index} className="border-b border-gray-100 last:border-none">
                    <td className="py-4 px-4 text-center border-r border-gray-100">{index + 1}</td>
                    <td className="py-4 px-4 border-r border-gray-100">{item.desc}</td>
                    <td className="py-4 px-4 text-center border-r border-gray-100">{item.size}</td>
                    <td className="py-4 px-4 text-center border-r border-gray-100">{item.qty}</td>
                    <td className="py-4 px-4 text-right border-r border-gray-100">{item.rate.toFixed(2)}</td>
                    <td className="py-4 px-4 text-right">{item.amount.toFixed(2)}</td>
                  </tr>
                ))}
                {/* Filler Rows to stretch table */}
                {[...Array(2)].map((_, i) => (
                  <tr key={`filler-${i}`}>
                    <td className="py-4 px-4 border-r border-gray-100 h-10"></td>
                    <td className="py-4 px-4 border-r border-gray-100 h-10"></td>
                    <td className="py-4 px-4 border-r border-gray-100 h-10"></td>
                    <td className="py-4 px-4 border-r border-gray-100 h-10"></td>
                    <td className="py-4 px-4 border-r border-gray-100 h-10"></td>
                    <td className="py-4 px-4 h-10"></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Bottom Section */}
          <div className="flex gap-8 mb-4">
            
            {/* Left Col (Terms, Bank) */}
            <div className="flex-1 flex flex-col gap-4">
              
              <div className="text-[9px] text-gray-700">
                <div className="bg-[#001B44] text-white font-bold px-2 py-1 inline-block rounded-sm mb-2 text-[10px]">TERMS & CONDITIONS</div>
                <ul className="list-disc pl-4 space-y-1">
                  <li>Payment must be made within the due date.</li>
                  <li>Goods once sold will not be taken back.</li>
                  <li>Design approval must be checked before printing.</li>
                  <li>We are not responsible for any spelling mistakes once design is approved.</li>
                </ul>
              </div>

              <div className="flex gap-4">
                <div className="flex-1 text-[10px] text-gray-800">
                  <div className="bg-[#001B44] text-white font-bold px-2 py-1 inline-block rounded-sm mb-2 text-[10px]">BANK DETAILS</div>
                  <table className="w-full">
                    <tbody>
                      <tr><td className="py-0.5 w-[65px]">Bank Name</td><td>:</td><td className="font-semibold">{invoiceData.bank.name}</td></tr>
                      <tr><td className="py-0.5">A/c Name</td><td>:</td><td className="font-semibold">{invoiceData.bank.accountName}</td></tr>
                      <tr><td className="py-0.5">A/c No.</td><td>:</td><td className="font-semibold">{invoiceData.bank.accountNo}</td></tr>
                      <tr><td className="py-0.5">IFSC Code</td><td>:</td><td className="font-semibold">{invoiceData.bank.ifsc}</td></tr>
                      <tr><td className="py-0.5">Branch</td><td>:</td><td className="font-semibold">{invoiceData.bank.branch}</td></tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            {/* Right Col (Totals) */}
            <div className="w-[300px]">
              <table className="w-full text-xs text-gray-800 border-l border-t border-gray-200">
                <tbody>
                  <tr className="border-b border-r border-gray-200">
                    <td className="py-2 px-4 font-bold bg-gray-50">SUB TOTAL</td>
                    <td className="py-2 px-4 text-right font-medium">₹ {invoiceData.financials.subtotal.toFixed(2)}</td>
                  </tr>
                  <tr className="border-b border-r border-gray-200">
                    <td className="py-2 px-4 font-bold bg-gray-50">DISCOUNT</td>
                    <td className="py-2 px-4 text-right font-medium">₹ {invoiceData.financials.discount.toFixed(2)}</td>
                  </tr>
                  <tr className="border-b border-r border-gray-200">
                    <td className="py-2 px-4 font-bold bg-gray-50">CGST (9%)</td>
                    <td className="py-2 px-4 text-right font-medium">₹ {invoiceData.financials.cgst.toFixed(2)}</td>
                  </tr>
                  <tr className="border-b border-r border-gray-200">
                    <td className="py-2 px-4 font-bold bg-gray-50">SGST (9%)</td>
                    <td className="py-2 px-4 text-right font-medium">₹ {invoiceData.financials.sgst.toFixed(2)}</td>
                  </tr>
                </tbody>
              </table>
              <div className="bg-[#001B44] text-white flex justify-between items-center px-4 py-3 font-bold text-lg rounded-b-md">
                <span>TOTAL AMOUNT</span>
                <span>₹ {invoiceData.financials.total.toFixed(2)}</span>
              </div>
              
              <div className="mt-3 text-[10px]">
                <p className="font-bold text-[#001B44] italic">Amount in Words:</p>
                <p className="text-gray-700 italic">{invoiceData.financials.amountInWords}</p>
              </div>
            </div>

          </div>

          {/* Footer Signature */}
          <div className="mt-auto border-t border-gray-200 pt-6 flex justify-between items-end">
            <div className="flex-1">
              <span className={`${greatVibes.className} text-4xl text-pink-600 tracking-wide`}>Thank you!</span>
              <span className={`${greatVibes.className} text-2xl text-[#001B44] ml-2`}>for your business...</span>
            </div>
            
            <div className="flex items-center gap-3 text-[9px] text-[#001B44]">
              {/* Fake QR */}
              <div className="w-12 h-12 border border-gray-300 p-1 bg-white">
                <div className="w-full h-full bg-[url('https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=feedback')] bg-cover"></div>
              </div>
              <div className="font-medium">
                <p className="font-bold text-[10px]">We value your feedback!</p>
                <p>Scan the QR code</p>
                <p>to review us on</p>
                <p>Google</p>
              </div>
            </div>

            <div className="flex-1 flex flex-col items-end text-[10px] text-[#001B44] font-bold">
              <span className="mb-10">For ADDESIGNER LASER PRINTER</span>
              <div className="w-[180px] border-t border-[#001B44]"></div>
              <span className="mt-1">Authorised Signatory</span>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
