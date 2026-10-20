export const DEFAULT_LAYOUTS = [
  {
    formKey: "JOB_FORM",
    name: "Job Form",
    description: "Fields used when creating a new printing job.",
    schema: {
      sections: [
        {
          id: "sec_job_basic",
          title: "Client Info",
          description: "Contact details for communication.",
          icon: "ph-user-circle",
          fields: [
            { id: "fld_b_client", name: "Client Name / Company", type: "SINGLE_LINE", mandatory: true },
            { id: "fld_b_phone", name: "Phone Number", type: "PHONE", mandatory: true },
            { id: "fld_b_email", name: "Email Address", type: "EMAIL", mandatory: false },
          ]
        },
        {
          id: "sec_job_event",
          title: "Job Details",
          description: "Details regarding the print job.",
          icon: "ph-printer",
          fields: [
            { id: "fld_b_date", name: "Order Date", type: "DATE", mandatory: true },
            { id: "fld_b_time", name: "Target Time", type: "TIME", mandatory: true },
            { id: "fld_b_job_category", name: "Job Category", type: "PICK_LIST", mandatory: false, options: ["Flex Printing", "Lighting Board", "LED Lighting Board", "Vinyl Printing", "Invitations", "Visiting Cards", "Litho Posters", "ID Cards", "Offset Printing", "Book Printing", "Trophy & Shields", "Screen Printing", "A3 Color Board Print", "Sticker Print"] },
            { id: "fld_b_job_status", label: "Job Status", type: "STATUS_PICKER", required: true, statusOptions: ["Pending", "Confirmed", "Completed", "Cancelled"], defaultValue: "Pending" },
            { id: "fld_b_location", name: "Delivery Location", type: "SINGLE_LINE", mandatory: true },
            { id: "fld_b_assigned_operator", name: "Assigned Operator/Designer", type: "USER_PICKLIST", mandatory: false },
            {
              id: "fld_b_status", name: "Status", type: "STATUS_PICKER", mandatory: false, statusOptions: [
                { label: "Pending", color: "bg-red-500" },
                { label: "Designing", color: "bg-yellow-500" },
                { label: "Printing", color: "bg-blue-500" },
                { label: "Ready for Delivery", color: "bg-emerald-500" },
                { label: "Delivered", color: "bg-slate-500" },
                { label: "Cancelled", color: "bg-gray-500" }
              ]
            },
          ]
        },
        {
          id: "sec_job_specs",
          title: "Job Specifications",
          description: "Technical specifications for the print job.",
          icon: "ph-list-dashes",
          fields: [
            { id: "fld_print_quantity", name: "Quantity", type: "NUMBER", mandatory: true },
            { id: "fld_print_paper_type", name: "Paper Type", type: "SINGLE_LINE", mandatory: false, placeholder: "e.g., Glossy, Matte, Art Board" },
            { id: "fld_print_gsm", name: "GSM", type: "NUMBER", mandatory: false, placeholder: "e.g., 300" },
            { id: "fld_print_dimensions", name: "Dimensions / Size", type: "SINGLE_LINE", mandatory: false, placeholder: "e.g., A4, 12x18" },
          ]
        },
        {
          id: "sec_job_financial",
          title: "Financials",
          description: "Package value, advance paid, and calculated remainder.",
          icon: "ph-currency-inr",
          fields: [
            { id: "fld_b_package", name: "Total Amount (₹)", type: "CURRENCY", mandatory: true },
            { id: "fld_b_advance", name: "Advance Paid (₹)", type: "CURRENCY", mandatory: false },
          ]
        }
      ]
    }
  },
  {
    formKey: "CLIENT_FORM",
    name: "Client Profile",
    description: "Fields collected for a client's profile.",
    schema: {
      sections: [
        {
          id: "sec_client_contact",
          title: "Contact Information",
          fields: [
            { id: "fld_c_name", name: "Client Full Name", type: "SINGLE_LINE", mandatory: true },
            { id: "fld_c_phone", name: "Phone Number", type: "PHONE", mandatory: true },
            { id: "fld_c_email", name: "Email Address", type: "EMAIL", mandatory: false },
          ]
        }
      ]
    }
  },
  {
    formKey: "TRANSACTION_FORM",
    name: "Transaction Form",
    description: "Fields used when recording a new income or expense.",
    schema: {
      sections: [
        {
          id: "sec_tx_details",
          title: "Transaction Details",
          fields: [
            { id: "fld_tx_amount", name: "Amount", type: "CURRENCY", mandatory: true },
            { id: "fld_tx_type", name: "Transaction Type", type: "PICK_LIST", mandatory: true, options: ["INCOME", "EXPENSE"] },
            { id: "fld_tx_date", name: "Date", type: "DATE", mandatory: true, isRecordDate: true },
            {
              id: "fld_tx_category", name: "Category", type: "MULTI_SELECT", mandatory: true, options: [
                "Printing Job",
                "Paper Purchase",
                "Ink/Toner",
                "Maintenance",
                "Binding",
                "Salary",
                "Travel",
                "Electricity",
                "Rent",
                "Other",
                "Job Advance"
              ]
            },
            { id: "fld_tx_mode", name: "Payment Mode", type: "PICK_LIST", mandatory: true, options: ["Cash", "Bank Transfer", "UPI", "Cheque"] },
            { id: "fld_tx_desc", name: "Description", type: "MULTI_LINE", mandatory: false },
          ]
        }
      ]
    }
  }
];
