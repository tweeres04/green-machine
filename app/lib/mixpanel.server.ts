import Mixpanel from 'mixpanel'
import invariant from 'tiny-invariant'

invariant(process.env.MIXPANEL_TOKEN, 'MIXPANEL_TOKEN not in .env')
export const mixpanelServer = Mixpanel.init(process.env.MIXPANEL_TOKEN)
