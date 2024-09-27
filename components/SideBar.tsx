'use client';

import React, { useState } from 'react'
import { Sidebar, SidebarBody, SidebarLink } from "@/components/nav/sidebar";
import { BookText, Images, Newspaper, Settings, SquarePen } from "lucide-react";
import Image from 'next/image';

const SideBar = () => {
    const links = [
        {
          label: "PV Register",
          href: "/",
          icon: (
            <BookText className="text-neutral-700 dark:text-neutral-200 h-5 w-5 flex-shrink-0" />
          ),
        },
        {
          label: "Create PV",
          href: "/create",
          icon: (
            <SquarePen className="text-neutral-700 dark:text-neutral-200 h-5 w-5 flex-shrink-0" />
          ),
        },
        {
          label: "Settings",
          href: "#",
          icon: (
            <Settings className="text-neutral-700 dark:text-neutral-200 h-5 w-5 flex-shrink-0" />
          ),
        }
    ];
  
    const [open, setOpen] = useState(false);

    return (
        <Sidebar open={open} setOpen={setOpen}>
            <SidebarBody className="justify-between gap-10 h-screen">
                <div className="fixed flex flex-col flex-1 overflow-y-auto overflow-x-hidden">
                <div className='place-items-center justify-center'>
                  <SidebarLink
                    className='font-bold'
                    link={{
                    label: "National Archives of Maldives",
                    href: "#",
                    icon: (
                        <Image
                          src={"/logo.png"}
                          className={`w-7 flex-shrink-0 justify-center`}
                          width={50}
                          height={50}
                          alt="Avatar"
                        />
                    ),
                    }}
                  />
                </div>
                  <div className="mt-8 flex flex-col gap-4">
                      {links.map((link, idx) => (
                      open ?
                          // If the link is the current screen, show the bar which indicates the screen the user is currently at
                          <SidebarLink key={idx} link={link} />
                          : 
                          <SidebarLink key={idx} link={link} />
                      ))}
                  </div>
                </div>
            </SidebarBody>
        </Sidebar>
    )
}

export default SideBar