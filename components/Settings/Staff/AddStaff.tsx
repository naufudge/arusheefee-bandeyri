import React from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
    Form,
    FormControl,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import axios, { AxiosResponse } from "axios";
import { NormalServerResponseType, Staff } from "@/lib/MyTypes";

interface AddStaffProps {
    button: React.ReactNode;
    refetchStaffs: () => Promise<void>;
    staff?: Staff;
}

const staffFormSchema = z.object({
    name: z.string().min(8, "Please write the full name of the staff."),
    designation: z.string().min(3, "Please write a valid designation.")
})

const AddStaff: React.FC<AddStaffProps> = ({ button, refetchStaffs, staff }) => {
    const { toast } = useToast();

    const form = useForm<z.infer<typeof staffFormSchema>>({
        resolver: zodResolver(staffFormSchema),
        defaultValues: {
          name: staff?.name ?? "",
          designation: staff?.designation ?? ""
        },
    })

    const onSubmit = async (values: z.infer<typeof staffFormSchema>) => {
        if (staff) {
            // Edit Staff
            
        } else {
            // Add Staff
            try {
                const response: AxiosResponse<NormalServerResponseType> = await axios.post("http://10.12.29.68:8000/staff", values)
                toast({
                    title: response.data.success ? "Success" : "Failed",
                    description: response.data.result,
                })

            } catch (error: unknown) {
                let errorMessage = "";
                if (error instanceof Error) {
                    errorMessage = error.message
                } else {
                    errorMessage = "An unknown error occurred."
                }
                toast({
                    title: "Error",
                    description: errorMessage,
                })
                console.log(errorMessage)
            }
        }

        await refetchStaffs();
    }

  return (
    <Dialog>
      <DialogTrigger asChild>{button}</DialogTrigger>
      <DialogContent className="bg-white p-8">
        <DialogHeader>
          <DialogTitle>
            {staff ? "Edit Staff Details" : "Add a Staff"}
          </DialogTitle>
          <DialogDescription>
            {staff
              ? "Edit this existing staff's details."
              : "Add a new staff to the system."}
          </DialogDescription>
        </DialogHeader>

        <div className="mt-4 grid">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Full Name</FormLabel>
                    <FormControl>
                      <Input placeholder="Full Name" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="designation"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Designation</FormLabel>
                    <FormControl>
                      <Input placeholder="Designation" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button type="submit">{staff ? "Save" : "Add"}</Button>
            </form>
          </Form>
        </div>

      </DialogContent>
    </Dialog>
  );
};

export default AddStaff;
