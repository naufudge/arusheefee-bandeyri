import React, { Dispatch, SetStateAction } from 'react'
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { PopupInfoType } from '@/lib/MyTypes'


interface PopupProps {
    open: boolean;
    setOpen: Dispatch<SetStateAction<boolean>>;
    info: PopupInfoType
}

const Popup: React.FC<PopupProps> = ({ open, setOpen, info }) => {
  return (
    <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className='bg-white'>
            <DialogHeader>
            <DialogTitle>{info.title}</DialogTitle>
            <DialogDescription>
                {info.detail}
            </DialogDescription>
            </DialogHeader>
        </DialogContent>
    </Dialog>
  )
}

export default Popup