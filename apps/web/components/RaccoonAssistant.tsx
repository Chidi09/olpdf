"use client";

import { useState, useEffect } from "react";
import { X, ArrowRight } from "lucide-react";
import Link from "next/link";

export default function RaccoonAssistant() {
    const [isVisible, setIsVisible] = useState(false);
    const [popoverOpen, setPopoverOpen] = useState(false);
    const [animClass, setAnimClass] = useState("anim-idle");
    const [contextMsg, setContextMsg] = useState({
        title: "Need a paw?",
        text: "I'm your trusty OLPDF guide! Looking to integrate our AST engine or just exploring?",
        primaryBtn: "View Documentation",
        primaryLink: "/docs",
        secondaryBtn: "Open Workspace",
        secondaryLink: "/dashboard"
    });

    useEffect(() => {
        const handleScroll = () => {
            // Show after scrolling 300px past the hero
            if (window.scrollY > 300) {
                if (!isVisible) setIsVisible(true);
            } else {
                if (isVisible) setIsVisible(false);
                if (popoverOpen) setPopoverOpen(false);
            }

            // Context switching based on scroll position
            const scrollHeight = document.documentElement.scrollHeight - window.innerHeight;
            const scrollPercent = scrollHeight > 0 ? window.scrollY / scrollHeight : 0;
            
            if (scrollPercent > 0.85) {
                setContextMsg({
                    title: "Ready to jump in?",
                    text: "We're 100% free forever. No paywalls, just documents. Start building today!",
                    primaryBtn: "Join the Community",
                    primaryLink: "/contribute",
                    secondaryBtn: "Star on GitHub",
                    secondaryLink: "https://github.com/chidi09/olpdf"
                });
            } else if (scrollPercent > 0.6) {
                setContextMsg({
                    title: "Want to embed this?",
                    text: "You can drop the OLPDF engine into your own app using our SDK. It's just two lines of code!",
                    primaryBtn: "Explore SDK",
                    primaryLink: "https://npmjs.com/package/@olpdf/embed",
                    secondaryBtn: "View API Docs",
                    secondaryLink: "/docs"
                });
            } else if (scrollPercent > 0.3) {
                setContextMsg({
                    title: "AST-Driven Editing",
                    text: "Our Web Worker reflows paragraphs and tables instantly. Go ahead, try the live editor!",
                    primaryBtn: "Try the Editor",
                    primaryLink: "/dashboard",
                    secondaryBtn: "Read the Spec",
                    secondaryLink: "/docs"
                });
            } else {
                setContextMsg({
                    title: "Need a paw?",
                    text: "I'm your trusty OLPDF guide! Looking to integrate our AST engine or just exploring?",
                    primaryBtn: "View Documentation",
                    primaryLink: "/docs",
                    secondaryBtn: "Open Workspace",
                    secondaryLink: "/dashboard"
                });
            }
        };

        window.addEventListener("scroll", handleScroll);
        // Initial check
        handleScroll();
        return () => window.removeEventListener("scroll", handleScroll);
    }, [isVisible, popoverOpen]);

    // Randomly wave to grab attention every 15 seconds if popover is closed
    useEffect(() => {
        if (popoverOpen || !isVisible) return;
        const interval = setInterval(() => {
            setAnimClass("anim-wave");
            setTimeout(() => setAnimClass("anim-idle"), 2000); // Wave for 2 seconds
        }, 15000);
        return () => clearInterval(interval);
    }, [popoverOpen, isVisible]);

    const handleMouseEnter = () => {
        setAnimClass("anim-wave");
    };

    const handleMouseLeave = () => {
        setAnimClass("anim-idle");
    };

    const togglePopover = () => {
        setPopoverOpen(!popoverOpen);
        if (!popoverOpen) {
            setAnimClass("anim-idle");
        }
    };

    return (
        <>
            <div className={\`fixed bottom-6 right-6 z-[9999] flex flex-col items-end gap-4 font-sans transition-all duration-700 \${isVisible ? 'translate-y-0 opacity-100' : 'translate-y-32 opacity-0 pointer-events-none'}\`}>
                {/* Popover */}
                <div className={\`bg-[#fdfdfc] dark:bg-[#1a1a1c] border border-[var(--border-strong)] rounded-2xl shadow-[0_32px_64px_rgba(0,0,0,0.3)] w-[320px] p-6 transition-all duration-300 transform origin-bottom-right \${popoverOpen ? "opacity-100 scale-100 translate-y-0" : "opacity-0 scale-95 translate-y-8 pointer-events-none"}\`}>
                    <div className="flex justify-between items-start mb-3">
                        <div className="flex items-center gap-2">
                            <span className="flex h-2 w-2 rounded-full bg-emerald-500 animate-pulse"></span>
                            <h4 className="text-base font-serif italic font-bold text-[var(--text-primary)]">{contextMsg.title}</h4>
                        </div>
                        <button onClick={togglePopover} className="text-[var(--text-tertiary)] hover:text-[var(--text-primary)] bg-[var(--bg-surface)] hover:bg-[var(--bg-elevated)] rounded-full p-1 transition-colors outline-none focus:ring-2 focus:ring-orange-500">
                            <X className="w-4 h-4" />
                        </button>
                    </div>
                    <p className="text-sm text-[var(--text-secondary)] mb-6 leading-relaxed font-medium">
                        {contextMsg.text}
                    </p>
                    <div className="flex flex-col gap-2.5">
                        <Link href={contextMsg.primaryLink} className="w-full py-2.5 bg-orange-500 text-white border-none rounded-xl text-[10px] uppercase tracking-widest font-black cursor-pointer text-center transition-transform hover:-translate-y-0.5 shadow-lg shadow-orange-500/20 flex items-center justify-center gap-2">
                            {contextMsg.primaryBtn} <ArrowRight className="h-3 w-3" />
                        </Link>
                        <Link href={contextMsg.secondaryLink} className="w-full py-2.5 bg-transparent text-[var(--text-primary)] border border-[var(--border-strong)] rounded-xl text-[10px] uppercase tracking-widest font-bold cursor-pointer text-center transition-colors hover:bg-[var(--bg-surface)] flex items-center justify-center">
                            {contextMsg.secondaryBtn}
                        </Link>
                    </div>
                    
                    {/* Speech bubble arrow pointing to raccoon */}
                    <div className="absolute -bottom-3 right-8 w-6 h-6 bg-[#fdfdfc] dark:bg-[#1a1a1c] border-b border-r border-[var(--border-strong)] transform rotate-45 rounded-sm"></div>
                </div>

                {/* Raccoon Sprite */}
                <div 
                    className={\`raccoon-sprite \${animClass}\`}
                    onClick={togglePopover}
                    onMouseEnter={handleMouseEnter}
                    onMouseLeave={handleMouseLeave}
                    title="Click for help!"
                />
            </div>

            <style dangerouslySetInnerHTML={{ __html: \`
                .raccoon-sprite {
                    width: 90px;
                    height: 90px;
                    background-image: url('/watermarked_img_14898494713393997498.png');
                    background-size: 360px 450px;
                    background-repeat: no-repeat;
                    cursor: pointer;
                    filter: drop-shadow(0 10px 25px rgba(0,0,0,0.3));
                    transition: transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
                    transform-origin: bottom center;
                    position: relative;
                    z-index: 10;
                }
                .raccoon-sprite:hover {
                    transform: scale(1.15) translateY(-5px) rotate(-3deg);
                }
                .raccoon-sprite:active {
                    transform: scale(0.95);
                }
                .anim-idle {
                    background-position-y: 0px; 
                    animation: play-sprite-frames 0.8s steps(4) infinite;
                }
                .anim-wave {
                    background-position-y: -270px; 
                    animation: play-sprite-frames 0.8s steps(4) infinite;
                }
                @keyframes play-sprite-frames {
                    from { background-position-x: 0px; }
                    to { background-position-x: -360px; }
                }
            \`}} />
        </>
    );
}
