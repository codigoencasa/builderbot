import { $, component$, QwikMouseEvent } from '@builder.io/qwik'

export const handleVideo = $((ev: QwikMouseEvent<HTMLVideoElement>) => {
    const targetVideo = ev.target as HTMLVideoElement
    targetVideo.play()
})

export default component$(() => {
    return (
        <section class="relative ">
            <div class="max-w-6xl mx-auto px-4 sm:px-6 ">
                <div class="py-0 md:py-5">
                    <video
                        class={'cursor-pointer'}
                        onClick$={handleVideo}
                        style={'height:600px'}
                        width="100%"
                        height="400"
                        autoPlay
                        muted
                        playsInline
                    >
                        <source
                            src="https://leifer-landing-page.s3.us-east-2.amazonaws.com/xbmcc-kx99h.webm"
                            type='video/mp4; codecs="hvc1"'
                        />

                        <source
                            src="https://leifer-landing-page.s3.us-east-2.amazonaws.com/xbmcc-kx99h.webm"
                            type="video/webm"
                        />
                    </video>
                </div>
            </div>
        </section>
    )
})
