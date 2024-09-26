'use client';

import React, { useState } from 'react'
import { Sidebar, SidebarBody, SidebarLink } from "@/components/nav/sidebar";
import { Bell, BookText, Images, Newspaper, Settings, SquarePen } from "lucide-react";


const SideBar = () => {
    const links = [
        // {
        //   label: "Dashboard",
        //   href: "#",
        //   icon: (
        //     <IconBrandTabler className="text-neutral-700 dark:text-neutral-200 h-5 w-5 flex-shrink-0" />
        //   ),
        // },
        {
          label: "PV Register",
          href: "#",
          icon: (
            <BookText className="text-neutral-700 dark:text-neutral-200 h-5 w-5 flex-shrink-0" />
          ),
        },
        {
          label: "Create PV",
          href: "#",
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
        },
        // {
        //   label: "Settings",
        //   href: "#",
        //   icon: (
        //     <IconSettings className="text-neutral-700 dark:text-neutral-200 h-5 w-5 flex-shrink-0" />
        //   ),
        // },
        // {
        //   label: "Log out",
        //   href: "#",
        //   icon: (
        //     <IconArrowLeft className="text-neutral-700 dark:text-neutral-200 h-5 w-5 flex-shrink-0" />
        //   ),
        // },
    ];
  
    const [open, setOpen] = useState(false);

    return (
        <Sidebar open={open} setOpen={setOpen}>
            <SidebarBody className="justify-between gap-10 fixed">
                <div className="flex flex-col flex-1 overflow-y-auto overflow-x-hidden">
                {/* Rewrite this logo logic because its throwing errors that should not be a thing 😭😭😭 */}
                {/* {open ? <Logo /> : <LogoIcon />} */}
                <div className="mt-8 flex flex-col gap-4">
                    {links.map((link, idx) => (
                    open ?
                        // If the link is the current screen, show the bar which indicates the screen the user is currently at
                        <SidebarLink key={idx} link={link} onClick={() => {}} />
                        : 
                        <SidebarLink key={idx} link={link} onClick={() => {}}/>
                    ))}
                </div>
                </div>
                <div>
                
                <SidebarLink
                    link={{
                    label: "admin",
                    href: "#",
                    icon: (
                        <img
                        src="https://plus.unsplash.com/premium_photo-1675130119373-61ada6685d63?q=80&w=387&auto=format&fit=crop&ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D"
                        className="h-7 w-7 flex-shrink-0 rounded-full"
                        width={50}
                        height={50}
                        alt="Avatar"
                        />
                    ),
                    }}
                />
                </div>
            </SidebarBody>
        </Sidebar>
    )
}

export default SideBar