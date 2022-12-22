import { component$, Slot } from '@builder.io/qwik'

import Footer from '~/components/widgets/Footer'
import Header from '~/components/widgets/Header'

export default component$(() => {
    // useClientEffect$(() => {
    //   if (
    //     localStorage.theme === "dark" ||
    //     (!("theme" in localStorage) &&
    //       window.matchMedia("(prefers-color-scheme: dark)").matches)
    //   ) {
    //     document.documentElement.classList.add("dark");
    //   } else {
    //     document.documentElement.classList.remove("dark");
    //   }
    // });

    return (
        <>
            <Header />
            <main>
                <Slot />
            </main>
            <Footer />
        </>
    )
})
