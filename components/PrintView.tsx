import React from 'react'
import { PvValues } from '@/lib/PvSchema'


const PrintView: React.FC<PvValues> = (PvValues) => {
  return (
    <div className='mx-5 text-[13px]'>
        <div className="container m-10 pb-4 outline outline-1 mx-auto max-w-[950px]">

            {/* Title, Acct. No. & Type */}
            <div className="grid grid-cols-5">
                <div className="text-xl mx-auto col-span-3">
                    <h1 className="text-center font-waheed text-[24px] mt-1">ޕޭމަންޓް ވައުޗަރ</h1>
                    <h1 className="text-center font-bold">Payment Voucher</h1>
                </div>
                
                <div className="grid grid-rows-2 col-span-2">
                    <div className="grid grid-cols-4 custom-border-1 child:px-2 child:col-span-2">
                        <div className='font-bold'>Acct. No. / <span className='dhivehi'>އެކައުންޓް</span></div>
                        <div className="text-center">{PvValues.businessArea}</div>
                    </div>
                    <div className="grid grid-cols-4 custom-border-1 child:px-2 child:col-span-2">
                        <div className='font-bold'>Type / <span className='dhivehi'>ބާވަތް</span></div>
                        <div className="underline text-center">Budget</div>
                    </div>
                </div>
            </div>
            
            <div className='grid grid-cols-5 border my-4 ml-2'>
                <div className='grid grid-rows-3 w-full col-span-3 custom-border-2'>
                    {/* Agency */}
                    <div className='grid grid-cols-3'>
                        <div>Agency / <span className='dhivehi'>އޮފީސް</span></div>
                        <div className='col-span-2'>{PvValues.agency}</div>
                    </div>
                    {/* Business Area */}
                    <div className='grid grid-cols-3'>
                        <div>Business Area / <span className='dhivehi'>ބ. އޭރިއާ</span></div>
                        <div className='col-span-2'>{PvValues.businessArea}</div>
                    </div>
                    {/* Vendor */}
                    <div className='grid grid-cols-3'>
                        <div>Vendor / <span className='dhivehi'>ލިބޭފަރާތް</span></div>
                        <div className='col-span-2'>{PvValues.vendor}</div>
                    </div>

                </div>

                <div className='grid grid-rows-3 w-full col-span-2 custom-border-2 center-data-col'>
                    {/* Date */}
                    <div className='grid grid-cols-2'>
                        <div>Date / <span className='dhivehi'>ތާރީޚް</span></div>
                        <div>21-Sep-2024</div>
                    </div>
                    {/* PV Number */}
                    <div className='grid grid-cols-2'>
                        <div>PV No. / <span className='dhivehi'>ޕީވީ</span></div>
                        <div>1506/2024/252</div>
                    </div>
                    {/* Number of Invoices */}
                    <div className='grid grid-cols-3'>
                        <div className='col-span-2'>Invoice(s) / <span className='dhivehi'>އިންވޮއިސްގެ އަދަދު</span></div>
                        <div>1</div>
                    </div>
                </div>
            </div>
            
            <div className='flex w-full h-[50px] ml-2'>
                <div className='place-items-center flex flex-col gap-1 justify-center font-bold'>
                    <span>Note:</span>
                    <span className='dhivehi'>ނޯޓު</span>
                </div>
                <div className='w-full outline outline-1 mx-5 p-1'>Write the note(s) here!</div>
            </div>
            
            {/* Invoice Details Section */}
            <div className='flex flex-col mt-3 ml-2'>
                <div className='font-bold mb-1'>Invoice Details / <span className='dhivehi'>އިންވޮއިސްގެ ތަފްޞީލް</span></div>

                <div className='grid grid-cols-6 custom-border-2'>
                    <div className='grid grid-cols-3 col-span-2'>
                        <div className='col-span-2'>Doc. Currency / <span className='dhivehi'>ފައިސާ</span></div>
                        <div>MVR</div>
                    </div>
                    <div className='grid grid-cols-4 col-span-4'>
                        <div className='col-span-3'>Doc. Curr. to MVR Exchange Rate / <span className='dhivehi'>އެކްސްޗޭންޖް ރޭޓް</span></div>
                        <div>1.0000</div>
                    </div>
                </div> 

                {/* Invoice Number, Date, Total, MVR */}
                <div className='grid grid-cols-4 custom-border-3'>
                    <div className='grid grid-rows-2'>
                        <div>Invoice No.</div>
                        <div>INV-1234</div>
                    </div>
                    <div className='grid grid-rows-2'>
                        <div>Invoice Date</div>
                        <div>01-May-2024</div>
                    </div>
                    <div className='grid grid-rows-2'>
                        <div>Invoice Total</div>
                        <div>10,000</div>
                    </div>
                    <div className='grid grid-rows-2'>
                        <div>MVR</div>
                        <div>10,000</div>
                    </div>
                </div>
            </div>

            {/* Comments */}
            <div className='flex mt-3 ml-2 child:px-1 child:py-1'>
                <div className='font-bold justify-center'>Comment(s): <span className='dhivehi'>ކޮމެންޓް</span></div>
                <div className='outline outline-1 w-full mr-3'>Write the comment(s) here!</div>
            </div>

            {/* GL Section */}
            <div className='grid mt-3 ml-2 child:text-center'>
                {/* Headings */}
                <div className='grid grid-cols-6 font-bold custom-border-1 child:py-1'>
                    <div>GL / Asset</div>
                    <div>Activity Ref.</div>
                    <div>Cost Ctr/Proj.</div>
                    <div>Fund</div>
                    <div>Amt. in Doc. Curr.</div>
                    <div>Amt. in MVR</div>
                </div>

                {/* Put a loop here if there are multiple GL Accounts under the same PV */}
                <div className='grid grid-cols-6 GL-table'>
                    <div>223001</div>
                    <div> </div>
                    <div> </div>
                    <div>C-GOM</div>
                    <div>500.00</div>
                    <div>500.00</div>
                </div>
            </div>

            {/* Gross Total Section */}
            <div className='grid grid-cols-10 mt-3 ml-2'>
                <div className='flex flex-col gap-1 col-span-1 justify-center place-items-center font-bold border'>
                    <span>Gross Total</span>
                    <span className='dhivehi'>މުޅި ޖުމްލަ</span>

                </div>
                <div className='col-span-1'>
                    <div className='grid child:py-2 child:border child:text-center child:px-4 h-full'>
                        <div>MVR</div>
                        <div>MVR</div>
                    </div>
                </div>
                <div className='col-span-6'>
                    <div className='grid child:py-2 child:border child:justify child:px-4'>
                        <div>Fifty-Five Thousand Two Hundred and Thirty-Four Rufiyaa, Fifty-Five Laari</div>
                        <div>Fifty-Five Thousand Two Hundred and Thirty-Four Rufiyaa, Fifty-Five Laari</div>
                    </div>
                </div>
                <div className='col-span-2'>
                    <div className='grid child:py-2 child:border child:text-right child:px-4 h-full'>
                        <div>55,234.55</div>
                        <div>55,234.55</div>
                    </div>
                </div>
            </div>


            {/* Payment Authorization Section */}
            <div className='mt-4 ml-2 border border-collapse'>
                <div className='font-bold px-2 py-1'>Payment Authorization / <span className="dhivehi">ފައިސާ ދެއްކުމުގެ ހުއްދަދިނުން</span></div>
                <div className='grid custom-border-4'>
                    {/* Prepared By */}
                    <div className="grid grid-cols-7 child:border child:border-collapse">
                        <div className='col-span-1 child:font-bold'>
                            <div>Prepared by:</div>
                            <div className='dhivehi'>ތައްޔާރު ކުރި</div>
                        </div> 
                        <div className='col-span-3 child:text-center'>
                            <div>Sharumeela Abdul Fatah</div>
                            <div>Accounts Officer</div>
                        </div>
                        <div className='col-span-1 flex place-items-center justify-center'>06-May-2024</div>
                        <div className='col-span-2'></div>
                    </div>

                    {/* Verified By */}
                    <div className="grid grid-cols-7 child:border child:border-collapse">
                        <div className='col-span-1 child:font-bold child:text-left'>
                            <div>Verified by:</div>
                            <div className='dhivehi'>ޗެކް ކުރި</div>
                        </div>
                        <div className='col-span-3 child:text-center'>
                            <div>Sharumeela Abdul Fatah</div>
                            <div>Accounts Officer</div>
                        </div>
                        <div className='col-span-1 flex place-items-center justify-center'>06-May-2024</div>
                        <div className='col-span-2'></div>
                    </div>

                    {/* Verified By 1 */}
                    <div className="grid grid-cols-7 child:border child:border-collapse">
                        <div className='col-span-1 child:font-bold child:text-left'>
                            <div>Authorised by:</div>
                            <div className='dhivehi'>ހުއްދަ ދިން</div>
                        </div>
                        <div className='col-span-3 child:text-center'>
                            <div>Sharumeela Abdul Fatah</div>
                            <div>Accounts Officer</div>
                        </div>
                        <div className='col-span-1 flex place-items-center justify-center'>06-May-2024</div>
                        <div className='col-span-2'></div>
                    </div>

                    {/* Verified By 2 */}
                    <div className="grid grid-cols-7 child:border child:border-collapse">
                        <div className='col-span-1 child:font-bold child:text-left'>
                            <div>Authorised by:</div>
                            <div className='dhivehi'>ހުއްދަ ދިން</div>
                        </div>
                        <div className='col-span-3 child:text-center'>
                            <div>Sharumeela Abdul Fatah</div>
                            <div>Accounts Officer</div>
                        </div>
                        <div className='col-span-1 flex place-items-center justify-center'>06-May-2024</div>
                        <div className='col-span-2'></div>
                    </div>
                </div>
            </div>

            {/* Payment Delivery Section */}
            <div className='mt-4 ml-2 border-collapse text-[12px]'>
                <div className="grid font-bold border-collapse child:h-fit">
                    <div className='row-span-1 border-t border-l border-r px-2 py-1'>Payment Delivery</div>
                    <div className="grid grid-cols-12 grid-rows-3 child:border child:p-1">
                        {/* First Row / Title */}
                        <div className='row-span-2'>Payment Type:</div>
                        {/* Middle Row */}
                        <div>Cheque</div>
                        <div>Transfer</div>
                        <div />
                        <div className="col-span-2">Receieved By:</div>
                        <div className='col-span-2' />
                        <div className='col-span-4 row-span-3' />
                        <div />
                        <div />
                        <div />
                        <div className="col-span-2">NID/PP/WP No.:</div>
                        <div className='col-span-2' />
                        {/* Last row */}
                        <div className='col-span-1'>Instr. No.:</div>
                        <div className='col-span-3' />
                        <div className='col-span-2'>Date:</div>
                        <div className='col-span-2' />
                    </div>
                </div>

            </div>


        </div>
    </div>
  )
}

export default PrintView