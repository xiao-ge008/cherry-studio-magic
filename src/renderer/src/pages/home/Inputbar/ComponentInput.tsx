import HorizontalScrollContainer from '@renderer/components/HorizontalScrollContainer'
import CustomTag from '@renderer/components/Tags/CustomTag'
import { ComponentConfig } from '@renderer/types/component'
import { Package } from 'lucide-react'
import { FC } from 'react'
import styled from 'styled-components'

interface Props {
  components: ComponentConfig[]
  onRemoveComponent: (component: ComponentConfig) => void
}

const ComponentInput: FC<Props> = ({ components, onRemoveComponent }) => {
  if (!components.length) return null

  return (
    <Container>
      <HorizontalScrollContainer dependencies={[components]} expandable>
        {components.map((component) => (
          <CustomTag
            key={component.id}
            icon={<Package size={14} />}
            color="#6366f1"
            closable
            onClose={() => onRemoveComponent(component)}>
            {component.name}
          </CustomTag>
        ))}
      </HorizontalScrollContainer>
    </Container>
  )
}

const Container = styled.div`
  width: 100%;
  padding: 5px 15px 0 15px;
`

export default ComponentInput

