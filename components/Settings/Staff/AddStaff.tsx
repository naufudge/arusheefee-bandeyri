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
import { Staff } from "@/lib/MyTypes";
import { useTRPC } from "@/lib/trpc";
import { useMutation } from "@tanstack/react-query";

interface AddStaffProps {
  button: React.ReactNode;
  refetchStaffs: () => void;
  staff?: Staff;
}

const staffFormSchema = z.object({
  name: z.string().min(8, "Please write the full name of the staff."),
  designation: z.string().min(3, "Please write a valid designation."),
});

const AddStaff: React.FC<AddStaffProps> = ({ button, refetchStaffs, staff }) => {
  const { toast } = useToast();
  const trpc = useTRPC();

  const form = useForm<z.infer<typeof staffFormSchema>>({
    resolver: zodResolver(staffFormSchema),
    defaultValues: {
      name: staff?.name ?? "",
      designation: staff?.designation ?? "",
    },
  });

  // Create staff mutation
  const createMutation = useMutation(
    trpc.staff.create.mutationOptions({
      onSuccess: () => {
        toast({
          title: "Success!",
          description: "Successfully added new staff!",
        });
        refetchStaffs();
      },
      onError: (error) => {
        toast({
          title: "Error",
          description: error.message || "An unknown error occurred.",
        });
      },
    })
  );

  // Update staff mutation
  const updateMutation = useMutation(
    trpc.staff.update.mutationOptions({
      onSuccess: () => {
        toast({
          title: "Updated!",
          description: "Successfully updated staff!",
        });
        refetchStaffs();
      },
      onError: (error) => {
        toast({
          title: "Error",
          description: error.message || "An unknown error occurred.",
        });
      },
    })
  );

  const onSubmit = (values: z.infer<typeof staffFormSchema>) => {
    if (staff) {
      // Edit Staff
      updateMutation.mutate({
        id: staff._id,
        name: values.name,
        designation: values.designation,
      });
    } else {
      // Add Staff
      createMutation.mutate(values);
    }
  };

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
